import api from "./analysisService";

export const chatService = {
  // `attachment` is stored data from a quick action. The backend gives it to the model but
  // keeps it out of the crisis pre-screen, which judges only what the user typed.
  async sendMessage(message, history = [], attachment = "") {
    const body = attachment ? { message, history, attachment } : { message, history };
    const { data } = await api.post("/chat/", body);
    return data;
  }
};
