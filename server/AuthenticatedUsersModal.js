const mongoose = require("mongoose");

const { Schema } = mongoose;
const AuthenticatedUsersSchema = new Schema({
  id: String,
  description: String,
  client: Object,
  status: String,
});

const AuthenticatedUsersModal = mongoose.model(
  "AuthenticatedUsers",
  AuthenticatedUsersSchema
);

module.exports = { AuthenticatedUsersModal };
