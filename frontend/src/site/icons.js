import {
  IconAward, IconBook, IconBriefcase, IconCard, IconChart, IconChat, IconCheck, IconClock, IconCode, IconDashboard, IconHeadset,
  IconLock, IconPlay, IconReceipt, IconShield, IconStar, IconTerminal, IconTest, IconUsers, IconZap,
} from "../components/Icons.jsx";

// Keys match the icon list the backend accepts (apps/website/schemas.py ICONS).
export const ICON_MAP = {
  code: IconCode, headset: IconHeadset, award: IconAward, test: IconTest, dashboard: IconDashboard, receipt: IconReceipt,
  shield: IconShield, play: IconPlay, chat: IconChat, book: IconBook, clock: IconClock, star: IconStar, check: IconCheck,
  users: IconUsers, chart: IconChart, zap: IconZap, terminal: IconTerminal, briefcase: IconBriefcase, card: IconCard, lock: IconLock,
};
export const iconFor = (key) => ICON_MAP[key] || IconCheck;
