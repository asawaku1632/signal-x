import { RunnerState, RunnerV2Error } from "./state-machine.mjs";
export class OperatorControl {
  #runner;#secretFactory;#authorize;#recoveryAuthorize;
  constructor({runner,secretFactory,authorize,recoveryAuthorize}){if(typeof authorize!=="function")throw new RunnerV2Error("OPERATOR_AUTHORIZER_REQUIRED");this.#runner=runner;this.#secretFactory=secretFactory;this.#authorize=authorize;this.#recoveryAuthorize=recoveryAuthorize;}
  async command(name,authorization={}){
    if(await this.#authorize({command:name,authorization,currentState:this.#runner.status.state})!==true)throw new RunnerV2Error("OPERATOR_NOT_AUTHORIZED");
    if(name==="ABORT")return this.#runner.abort("OPERATOR_ABORT");
    if(name==="CLEANUP"){if(this.#runner.status.state===RunnerState.HOLD)throw new RunnerV2Error("HOLD_REQUIRES_ABORT_OR_RECOVERY");return this.#runner.cleanup();}
    if(name==="VERCEL_RECOVERY_OBSERVE")return this.#runner.observeVercelRecovery(authorization.observation);
    if(name==="RECOVER_VERCEL_PRESENT"){if(typeof this.#recoveryAuthorize!=="function")throw new RunnerV2Error("RECOVERY_AUTHORIZER_REQUIRED");const context={runId:this.#runner.status.runId,registrationAttemptId:this.#runner.status.registrationAttemptId,observation:this.#runner.status.recoveryObservation,currentState:this.#runner.status.state};const binding=await this.#recoveryAuthorize({authorization,context});if(!binding)throw new RunnerV2Error("RECOVERY_NOT_AUTHORIZED");return this.#runner.completeVercelRecovery(binding);}
    if(name==="RESUME")return this.#runner.resume({authorized:true});
    if(this.#runner.status.state===RunnerState.HOLD)throw new RunnerV2Error("HOLD_COMMAND_REJECTED");
    const actions={ACTIVATE:[RunnerState.PREFLIGHT,()=>this.#runner.preflight()],ROTATE:[RunnerState.READY_FOR_ACTIVATION,()=>this.#runner.rotate({secretFactory:this.#secretFactory})],DIRECT_AUTH:[RunnerState.DIRECT_AUTH,()=>this.#runner.directAuth()],DIRECT_IDENTITY_CHECK:[RunnerState.DIRECT_IDENTITY_CHECK,()=>this.#runner.directIdentityCheck()],POOLER_AUTH:[RunnerState.POOLER_AUTH,()=>this.#runner.poolerAuth()],POOLER_IDENTITY_CHECK:[RunnerState.POOLER_IDENTITY_CHECK,()=>this.#runner.poolerIdentityCheck()],VERCEL_REGISTER:[RunnerState.VERCEL_REGISTER,()=>this.#runner.vercelRegister()],VERIFY_ENV_METADATA:[RunnerState.VERIFY_ENV_METADATA,()=>this.#runner.verifyEnvMetadata()]};
    const action=actions[name];if(!action||action[0]!==this.#runner.status.state)throw new RunnerV2Error("OPERATOR_COMMAND_REJECTED");return action[1]();
  }
}
