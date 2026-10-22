import MayaChat from "@/components/maya/MayaChat";

import { assistantName } from "@/config/brand";
export default function MayaPage() {
  return (
    <div style={{display:"grid", gap:16}}>
      <h2>{assistantName()}</h2>
      <MayaChat />
    </div>
  );
}
