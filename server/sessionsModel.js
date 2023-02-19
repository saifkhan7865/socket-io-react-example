const mongoose = require("mongoose");

const { Schema } = mongoose;
const sessionsModelSchema = new Schema({
  id: String,
  status: String,
  groupid: String,
});

const sessionsModel = mongoose.model("sessions", sessionsModelSchema);
module.exports = { sessionsModel };
