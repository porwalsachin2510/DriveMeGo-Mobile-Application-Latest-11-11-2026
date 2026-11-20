"use client";

import { useState } from "react";
import AdminPosts from "./AdminPosts";
import AdminContests from "./AdminContests";
import AdminFaqs from "./AdminFaqs";
import AdminFeedback from "./AdminFeedback";
import "./AdminEngagement.css";

const TABS = [
  {
    id: "posts",
    label: "News & Blog",
    hint: "Write articles commuters read in the mobile app.",
    Component: AdminPosts,
  },
  {
    id: "contests",
    label: "Contests",
    hint: "Run giveaways, track entries and pick winners.",
    Component: AdminContests,
  },
  {
    id: "faqs",
    label: "FAQs",
    hint: "Answers shown in the app help centre.",
    Component: AdminFaqs,
  },
  {
    id: "feedback",
    label: "Feedback",
    hint: "Read and reply to commuter feedback.",
    Component: AdminFeedback,
  },
];

function AdminEngagement() {
  const [active, setActive] = useState("posts");
  const tab = TABS.find((t) => t.id === active) || TABS[0];
  const ActiveComponent = tab.Component;

  return (
    <section className="eng-wrap eng-hub">
      <header className="eng-hub-head">
        <div>
          <h2>Commuter engagement</h2>
          <p>{tab.hint}</p>
        </div>
      </header>
      <div className="eng-tabs" role="tablist" aria-label="Engagement sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            className={`eng-tab ${t.id === active ? "active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <ActiveComponent />
      </div>
    </section>
  );
}

export default AdminEngagement;
