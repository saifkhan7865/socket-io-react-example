const listenToObjects = (mongoose, sessions) => {
  sessions.forEach((session) => {
    try {
      const client = session?.client;
      client?.on("message", (message) => {
        // console.log(message);
        console.log(message?.id?.remote);
        console.log(session?.groudid, "session");
        if (message.id.remote === sessions?.groupid) {
          console.log("message is from the group");
          console.log(message);
        }
      });
      client?.on("message_ack", (message_ack) => {
        console.log(message_ack);
      });
      client?.on("message_reaction", (message_reaction) => {
        console.log(message_reaction);
      });
      client?.on("message_create", (message_create) => {
        console.log(message_create);
      });
      client?.on("group_join", async (group_join) => {
        console.log(group_join);
        const joinedParticipant = await group_join.getContact();
        console.log(joinedParticipant);
      });
      client?.on("disconnected", (disconnected) => {
        console.log(disconnected);
      });
      client?.on("group_leave", async (group_leave) => {
        console.log(group_leave);
        const leftParticipant = await group_leave.getContact();
      });
      client?.on("remove_session_saved", (remove_session_saved) => {
        console.log(remove_session_saved);
      });
    } catch (error) {
      console.log(error);
    }
  });
};

module.exports = {
  listenToObjects,
};
