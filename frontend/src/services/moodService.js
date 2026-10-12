import api from "./analysisService";
import { formatLocalDate } from "../lib/dates";

// `logged_date` is the user's local calendar date so late-evening entries are not
// filed under tomorrow (UTC) on the heatmap.
export const logMood = (data) =>
  api.post("/mood/", { logged_date: formatLocalDate(), ...data }).then(r => r.data);
export const getMoodHeatmap = () => api.get("/mood/heatmap").then(r => r.data);
export const getMoodTrends = (days = 30) => api.get(`/mood/trends?days=${days}`).then(r => r.data);
