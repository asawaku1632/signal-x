import pg from "pg";
import { ForwardRotationRunnerV2 } from "./state-machine.mjs";
import { OperatorControl } from "./operator-control.mjs";
import { createProductionOperatorAuthorizer } from "./operator-authorization.mjs";
import { createProductionAdapters, createProductionSecretBuffer, DIRECT_CONFIG, POOLER_CONFIG } from "./production-adapters.mjs";
import { createPgIdentityDriver, createRotationDriver, createSafeProcessExecutor, createVercelCliDriver } from "./real-drivers.mjs";
import { createPrivilegedClientFactory } from "./privileged-client-factory.mjs";
import { createRecoveryAuthorizer } from "./recovery-authorization.mjs";
import { createProductionTrustedWindowsKeyReadProvider, loadTrustedKeyReadBinding } from "./trusted-windows-key-reader.mjs";

// Construction is inert: Client/process instances are created only after a
// signed ACTIVATE command advances the runner to their guarded states.
function buildRuntime({ trustedOperatorPublicKey, approvedOperatorKeyFingerprint, privilegedCredentialProvider, preflight, ClientClass = pg.Client, PrivilegedClientClass = pg.Client, processExecutor = createSafeProcessExecutor() }) {
  const privilegedClientFactory=createPrivilegedClientFactory({credentialProvider:privilegedCredentialProvider,ClientClass:PrivilegedClientClass});
  if (typeof preflight !== "function") throw new TypeError("preflight binding required");
  const clientFactory = config => new ClientClass(config);
  const adapters = createProductionAdapters({
    rotationDriver: createRotationDriver({ privilegedClientFactory }),
    directDriver: createPgIdentityDriver({ endpoint: DIRECT_CONFIG, clientFactory }),
    poolerDriver: createPgIdentityDriver({ endpoint: POOLER_CONFIG, clientFactory }),
    vercelDriver: createVercelCliDriver({ processExecutor }), preflight,
  });
  const runner = new ForwardRotationRunnerV2({ adapters });
  const authorize = createProductionOperatorAuthorizer({ trustedPublicKey: trustedOperatorPublicKey, approvedFingerprint:approvedOperatorKeyFingerprint });
  const recoveryAuthorize=createRecoveryAuthorizer({trustedPublicKey:trustedOperatorPublicKey,approvedFingerprint:approvedOperatorKeyFingerprint});
  const control = new OperatorControl({ runner, authorize, recoveryAuthorize, secretFactory: createProductionSecretBuffer });
  return Object.freeze({
    command:(name,authorization)=>control.command(name,authorization),
    get status(){return runner.status;},
    get events(){return runner.events;},
  });
}
export function createTestProductionRuntime(bindings){return buildRuntime(bindings);}
export async function createProductionRuntime({approvedHelperHashProvider,approvedFingerprintProvider,helperInspector,runnerSid,provisionerSids,privilegedCredentialProvider,preflight}){const keyReadProvider=createProductionTrustedWindowsKeyReadProvider({approvedHelperHashProvider,helperInspector,runnerSid,provisionerSids});const trust=await loadTrustedKeyReadBinding({keyReadProvider,approvedFingerprintProvider});return buildRuntime({privilegedCredentialProvider,preflight,...trust});}
