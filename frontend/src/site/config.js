// Nothing about the company, offers or homepage content lives in code any more:
// it all comes from the API (Console → Website). This file only keeps one UI helper.
export const openChat = () => window.dispatchEvent(new Event("itd:open-chat"));
