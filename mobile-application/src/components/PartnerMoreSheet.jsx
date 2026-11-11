import { MenuSheet } from "./MenuSheet";

const ITEMS = [
  { icon: "calendar-outline", title: "Schedules", href: "/partner/schedules" },
  { icon: "car-sport-outline", title: "Fleet & Drivers", href: "/partner/fleet" },
  { icon: "chatbox-ellipses-outline", title: "Route Requests", href: "/partner/requests" },
  { icon: "trending-up-outline", title: "Earnings", href: "/partner/earnings" },
  { icon: "wallet-outline", title: "Wallet", href: "/partner/wallet" },
  { icon: "pricetag-outline", title: "My Commission", href: "/partner/commission" },
  { icon: "business-outline", title: "Settlements", href: "/partner/settlements" },
  { icon: "star-outline", title: "My Ratings", href: "/partner/ratings" },
  { icon: "newspaper-outline", title: "News & Updates", href: "/news" },
  { icon: "notifications-outline", title: "Notifications", href: "/notifications" },
  { icon: "person-circle-outline", title: "Account", href: "/partner/account" },
  { icon: "help-circle-outline", title: "Help & FAQs", href: "/faqs" },
  { icon: "document-text-outline", title: "Terms & Conditions", href: "/page/terms-and-conditions" },
  { icon: "shield-checkmark-outline", title: "Privacy Policy", href: "/page/privacy-policy" },
  { icon: "mail-outline", title: "Contact Us", href: "/page/contact-us" },
];

export function PartnerMoreSheet({ visible, onClose }) {
  return <MenuSheet visible={visible} onClose={onClose} items={ITEMS} />;
}
