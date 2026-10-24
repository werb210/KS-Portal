# Beta programme (KS-Portal)

Keystone operations (KS-Ops) runs the beta programme; the licensee's KS-server keeps its list of beta features. See
KS-Ops `docs/BETA_PROGRAMME.md` for how a beta is created. Code marker: `KS_PORTAL_BETA_v1`.

## Settings > Labs (Admins)

Lists the betas open to the brokerage with name, description and a status badge (Private beta, Public beta, Now
available). Admins can **Join** or **Leave** a public beta and **Send feedback** on one they are in. Join, leave and
feedback go to `POST /api/beta/features/:key/join|leave|feedback` on KS-server, which forwards them to KS-Ops.

## Gating a feature

```tsx
import { useBetaFlag } from "@/beta/betaStore";
import { BetaBadge, BetaGate } from "@/beta/BetaBadge";

const on = useBetaFlag("ai_call_notes");
<BetaGate flag="ai_call_notes"><NewThing /><BetaBadge /></BetaGate>
```

Every beta is off until KS-server says it is on (also when the server is older and answers 404). `BetaBadge` is the
small "Beta" label to show next to a gated feature.
