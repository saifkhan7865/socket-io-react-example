const express = require("express");
const app = express();
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const {
  Client,
  MessageMedia,
  LocalAuth,
  RemoteAuth,
} = require("whatsapp-web.js");
const { MongoStore } = require("wwebjs-mongo");
const mongoose = require("mongoose");
const { sessionsModel } = require("./sessionsModel");
const { listenToObjects } = require("./listenToMessages");
app.use(cors());
const MONG_URI = "mongodb+srv://Saif:Arhaan123@cluster0.mj6hd.mongodb.net/test";
mongoose.set("strictQuery", false);
mongoose.connect(MONG_URI);
let sessions = [];
const server = http.createServer(app);
let store;
mongoose.connection.on("connected", () => {
  console.log("connected to mongo");
  store = new MongoStore({ mongoose: mongoose });
  const mongoSessions = sessionsModel.find().lean();
  if (mongoSessions.length > 0) {
    sessions = [...mongoSessions];
  }
  init();
});

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const SESSIONS_FILE = "./whatsapp-sessions.json";

const setSessionsFile = function (newsession) {
  sessions.push(newsession);
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
};

const createOrUpdateSessionOnRemote = async (id, status, client, type) => {
  try {
    if (type === "delete") {
      const sessions = await sessionsModel.deleteOne({ id: id });
      console.log("session is deleted");
    }
    const existingSession = await sessionsModel.find({ id: id });

    if (existingSession.length === 0) {
      console.log("creating session");
      const sessions = await sessionsModel.create({
        id: id,
        status: status,
      });
      console.log(sessions + "session is created");
    } else {
      // update session
      const updatedSession = await sessionsModel.findOneAndUpdate(
        {
          id: id,
        },
        {
          $set: {
            status: status,
          },
        }
      );

      console.log("session is updated", existingSession);
    }
  } catch (err) {
    console.log(err);
  }
};

const getSessionsFile = function () {
  try {
    const sessions = sessionsModel.find().lean();
    return sessions;
  } catch (err) {
    console.log(err);
    return [];
  }
};
const getSessionsRemote = async function () {
  try {
    const sessions = await sessionsModel.find().lean();
    return sessions;
  } catch (err) {
    console.log(err);
    return [];
  }
};
const createSession = async function (id, description, socket) {
  const sessionsExistsLocally = sessions.filter((session) => session.id === id);
  if (sessionsExistsLocally.length > 0) {
    console.log("session already exists locally");
    io.to(id).emit("ready", { id: id });
    return;
  }
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
    authStrategy: new RemoteAuth({
      clientId: id,
      store: store,
      backupSyncIntervalMs: 300000,
    }),
  });

  client.initialize();

  client.on("qr", (qr) => {
    console.log("QR RECEIVED", qr);
    createOrUpdateSessionOnRemote(id, "pending", client, null);
    io.to(id).emit("qr", { id: id, src: qr });
    io.to(id).emit("message", {
      id: id,
      text: "QR Code received, scan please!",
    });
  });

  client.on("ready", () => {
    console.log("Whatsapp is ready!");
    io.to(id).emit("ready", { id: id });
    io.to(id).emit("message", { id: id, text: "Whatsapp is ready!" });
  });

  client.on("authenticated", async () => {
    io.to(id).emit("authenticated", { id: id });
    io.to(id).emit("message", { id: id, text: "Whatsapp is authenticated!" });
    createOrUpdateSessionOnRemote(id, "connected", client, null);
    sessions.push({
      id: id,
      client: client,
    });
    const mongoSessions = await sessionsModel.find().lean();
    if (mongoSessions.length > 0) {
      //  add the field groupid to the existing sessions by comparing the id
      let cacheSessions = sessions.map((session) => {
        const mongoSession = mongoSessions.find(
          (mongoSession) => mongoSession.id === session.id
        );
        if (mongoSession) {
          session.groupid = mongoSession?.groupid ?? "";
        }
        return session;
      });
      listenToObjects(mongoose, sessions);
    }
  });

  client.on("auth_failure", function () {
    io.to(id).emit("message", { id: id, text: "Auth failure, restarting..." });
    createOrUpdateSessionOnRemote(id, "connected", client, "delete");
  });

  client.on("disconnected", (reason) => {
    io.to(id).emit("message", { id: id, text: "Whatsapp is disconnected!" });
    client.destroy();
    createOrUpdateSessionOnRemote(id, "connected", client, "delete");
    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);
    io.emit("remove-session", id);
  });

  // if (sessionIndex == -1) {
  // setSessionsFile(savedSessions);
  createOrUpdateSessionOnRemote(id, "connected", client, null);
  // }
};

const init = async function (socket) {
  const savedSessions = getSessionsFile();

  const savedSessionInMongo = await getSessionsRemote();
  if (savedSessionInMongo.length > 0) {
    if (socket) {
      savedSessionInMongo.forEach((e, i, arr) => {
        arr[i].ready = false;
      });
      socket.emit("init", savedSessionInMongo);
    } else {
      savedSessionInMongo.forEach((sess) => {
        createSession(sess?.id, sess?.description, socket);
      });
    }
  }
  if (savedSessions.length > 0) {
    if (socket) {
      /**
       * At the first time of running (e.g. restarting the server), our client is not ready yet!
       * It will need several time to authenticating.
       *
       * So to make people not confused for the 'ready' status
       * We need to make it as FALSE for this condition
       */
      savedSessions.forEach((e, i, arr) => {
        arr[i].ready = false;
      });

      socket.emit("init", savedSessions);
    } else {
      savedSessions.forEach((sess) => {
        createSession(sess.id, sess.description, socket);
      });
    }
  }
};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);
  init(socket);

  socket.on("create-session", function (data) {
    console.log("Create session: " + data.id);
    socket.join(data.id);
    io.to(data.id).emit("newmessage", "Hello from server");

    createSession(data.id, data.description, socket);
  });
});

app.get("/getChats/:sessionid", async (req, res) => {
  try {
    const sessionid = req.params.sessionid;
    const session = sessions.find((sess) => sess.id == sessionid);
    const client = session.client;
    const chats = await client.getChats();
    const groups = chats.filter((chat) => chat.isGroup);

    // only get the groups where the user is admin
    const adminGroups = groups.filter((group) => {
      const data = group.participants.find(
        (a) => a?.id?._serialized == client?.info?.wid?._serialized
      );
      if (data?.isAdmin || data?.isSuperAdmin) return data;
    });

    res.send(adminGroups);
  } catch (error) {
    console.log(error);
  }
});

app.get("/connectGroupToUsersAccount/:sessionid/:groupid", async (req, res) => {
  try {
    const sessionid = req.params.sessionid;
    const groupid = req.params.groupid;
    const sessions = await sessionsModel.findOneAndUpdate(
      {
        id: sessionid,
      },
      {
        groupid: groupid,
      }
    );

    const allSessions = await sessionsModel.find();
    sessions = [...allSessions];
    listenToObjects(mongoose, sessions);
    res.json(sessions);
  } catch (error) {
    console.log(error);
  }
});

app.get("/getAllChatsOfGroup/:sessionid/:nameOfTheGroup", async (req, res) => {
  try {
    const nameOfTheGroup = req.params.nameOfTheGroup;
    const sessionid = req.params.sessionid;
    const groupid = req.params.groupid;
    const session = sessions.find((sess) => sess.id == sessionid);
    const client = session.client;
    const chats = await client.getChats();
    //get all groups

    const group = chats.find((chat) => chat.name == "Boys Fam 🤩");
    const groupChats = await group.fetchMessages();
    res.send(groupChats);
  } catch (error) {
    console.log(error);
  }
});

app.get(
  "/getMessageInfo/:sessionid/:groupname/:messageid",
  async (req, res) => {
    try {
      const sessionid = req.params.sessionid;
      const groupname = req.params.groupname;
      const messageid = req.params.messageid;
      const session = sessionsModel.find((sess) => sess.id == sessionid);
      const client = getClientForMongoSession(session);
      // const client = session.client;
      const chats = await client.getChats();

      const group = chats.find((chat) => chat.name == "Boys Fam 🤩");

      const groupChats = await group.fetchMessages();
      const message = groupChats.find((msg) => msg.id.id == messageid);

      const messageInfo = await message.getInfo();
      res.send(messageInfo);
    } catch (error) {
      console.log(error);
    }
  }
);

server.listen(3001, () => {
  console.log("SERVER IS RUNNING");
});
