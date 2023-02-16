const express = require("express");
const app = express();
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Client, MessageMedia, LocalAuth } = require("whatsapp-web.js");
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
const sessions = [];
const SESSIONS_FILE = "./whatsapp-sessions.json";

const createSessionsFileIfNotExists = function () {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log("Sessions file created successfully.");
    } catch (err) {
      console.log("Failed to create sessions file: ", err);
    }
  }
};

createSessionsFileIfNotExists();

const setSessionsFile = function (newsession) {
  sessions.push(newsession);
  // fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
  //   // console.log("hello");
  //   // if (err) {
  //   //   console.log(err);
  //   // } else {
  //   //   console.log("Sessions file updated successfully.");
  //   // }
  // });
};

const getSessionsFile = function () {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE));
  } catch (err) {
    console.log(err);
    return [];
  }
};
const createSession = function (id, description, socket) {
  console.log("Creating session: " + id);
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
    authStrategy: new LocalAuth({
      clientId: id,
    }),
  });

  client.initialize();

  client.on("qr", (qr) => {
    console.log("QR RECEIVED", qr);

    io.to(id).emit("qr", { id: id, src: qr });
    io.to(id).emit("message", {
      id: id,
      text: "QR Code received, scan please!",
    });
  });

  client.on("ready", () => {
    io.to(id).emit("ready", { id: id });
    io.to(id).emit("message", { id: id, text: "Whatsapp is ready!" });

    // const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    // setSessionsFile(savedSessions);
  });

  client.on("authenticated", () => {
    io.to(id).emit("authenticated", { id: id });
    io.to(id).emit("message", { id: id, text: "Whatsapp is authenticated!" });
  });

  client.on("auth_failure", function () {
    io.to(id).emit("message", { id: id, text: "Auth failure, restarting..." });
  });

  client.on("disconnected", (reason) => {
    io.to(id).emit("message", { id: id, text: "Whatsapp is disconnected!" });
    client.destroy();
    // client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit("remove-session", id);
  });

  // Tambahkan client ke sessions
  sessions.push({
    id: id,
    description: description,
    client: client,
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);

  if (sessionIndex == -1) {
    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
};

const init = function (socket) {
  const savedSessions = getSessionsFile();

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

// init();

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);
  init(socket);
  socket.on("join_room", (data) => {
    console.log(data);
    socket.join(data);
  });

  socket.on("send_message", (data) => {
    socket.to(data.room).emit("receive_message", data);
  });
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
    res.send(chats);
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
    // TODO: later on use the name of the group from the frontend
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
      const session = sessions.find((sess) => sess.id == sessionid);
      const client = session.client;
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

app.get("getMessageInfo");
