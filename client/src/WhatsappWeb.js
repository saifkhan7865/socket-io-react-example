import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";

const WhatsappWeb = ({ socket }) => {
  const [clients, setClients] = useState([]);
  const clientRef = useRef();
  const [qrCode, setQrCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [getAllChats, setAllChats] = useState([]);

  console.log(clients);
  useEffect(() => {
    socket.on("init", (data) => {
      console.log("hello", data);

      setClients(data);
    });
    socket.on("qr", (data) => {
      console.log(data);
      setQrCode(data?.src);
    });

    socket.on("ready", (data) => {
      console.log(data);

      debugger;
      console.log(clientRef);
      console.log(clientRef.current);
      const updatedClients = [...clientRef.current];
      const clientIndex = updatedClients.findIndex(
        (client) => client.id === data.id
      );
      updatedClients[clientIndex].ready = true;
      debugger;
      setClients(updatedClients);
    });

    socket.on("message", (data) => {
      debugger;
      console.log(data);
    });

    socket.on("newmessage", (data) => {
      debugger;
      console.log(data);
    });
  }, [clientRef, clients, socket]);

  useEffect(() => {
    clientRef.current = clients;
  }, [clients]);

  const getAllChatsHandler = (id) => {
    fetch("http://localhost:3001/getChats/" + id, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "GET",
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
      });
  };

  const getAllMessagesHandler = (id) => {
    fetch(
      "http://localhost:3001/getAllChatsOfGroup/" + id + "/randomGroupName",
      {
        headers: {
          "Content-Type": "application/json",
        },
        method: "GET",
      }
    )
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
      });
  };

  const getMessageInfoHandler = (id) => {
    try {
      fetch(
        "http://localhost:3001/getMessageInfo/" +
          id +
          "/groupname" +
          "/B4E8ADBD03D1BF9377C9036102AEC9A1",
        {
          headers: {
            "Content-Type": "application/json",
          },
          method: "GET",
        }
      )
        .then((res) => res.json())
        .then((data) => {
          console.log(data);
        });
    } catch (error) {
      console.log(error);
    }
  };
  const handleAddClient = () => {
    const clientId = document.getElementById("client-id").value;
    const clientDescription =
      document.getElementById("client-description").value;

    const clientClass = `client-${clientId}`;

    const newClient = {
      id: clientId,
      description: clientDescription,
      class: clientClass,
      logs: ["Connecting..."],
      qrCode: "",
    };

    setClients([...clients, newClient]);

    socket.emit("create-session", {
      id: clientId,
      description: clientDescription,
    });
  };
  return (
    <div>
      {" "}
      <div id="app">
        <h1>Whatsapp API</h1>
        <p>Powered by Ngekoding</p>
        <div className="form-container">
          <label htmlFor="client-id">ID</label>
          <br />
          <input type="text" id="client-id" placeholder="Masukkan ID" />
          <br />
          <br />
          <label htmlFor="client-description">Deskripsi</label>
          <br />
          <textarea
            rows="3"
            id="client-description"
            placeholder="Masukkan deskripsi"
          ></textarea>
          <br />
          <button className="add-client-btn" onClick={handleAddClient}>
            Tambah Client
          </button>
        </div>
        <div className="client-container">
          {clients.map((client) => (
            <div className={`client ${client.class}`} key={client.id}>
              <h3 className="title">{client.id}</h3>
              <p className="description">{client.description}</p>
              {/* {client.qrCode && (
                <img src={client.qrCode} alt="QR Code" id="qrcode" />
              )} */}
              <h3>Logs:</h3>
              <div>Ready:{String(client?.ready)}</div>

              {client?.ready && (
                <button onClick={() => getAllChatsHandler(client.id)}>
                  Get All Chats
                </button>
              )}

              {client?.ready && (
                <button onClick={() => getAllMessagesHandler(client.id)}>
                  Get All Message of group
                </button>
              )}
              {client?.ready && (
                <button onClick={() => getMessageInfoHandler(client.id)}>
                  Get Message Info
                </button>
              )}
            </div>
          ))}
        </div>

        <div>{qrCode && <QRCode value={qrCode} />}</div>
      </div>
    </div>
  );
};

export default WhatsappWeb;
