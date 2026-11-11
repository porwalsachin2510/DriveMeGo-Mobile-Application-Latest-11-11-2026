import { WalletView } from "../../src/components/WalletView";
import { PartnerHeader } from "../../src/components/partner";

export default function PartnerWallet() {
  return <WalletView header={<PartnerHeader back />} tabBarSpace={false} />;
}
