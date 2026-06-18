import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { ChatPage } from "./pages/ChatPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { LiveMeetingPage } from "./pages/LiveMeetingPage.jsx";
import { MeetingDetailsPage } from "./pages/MeetingDetailsPage.jsx";
import { UploadPage } from "./pages/UploadPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/live" element={<LiveMeetingPage />} />
        <Route path="/meetings/:id" element={<MeetingDetailsPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
