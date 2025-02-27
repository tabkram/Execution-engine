import { EngineNodeData } from './engineNodeData.model';
import { ExecutionTrace, ExecutionTraceExtractor } from './executionTrace.model';


export interface TraceOptions<I, O> {
  trace?: Partial<EngineNodeData>;
  config?: {
    traceExecution?: boolean | Array<keyof ExecutionTrace<I, O>> | ExecutionTraceExtractor<I, O>;
    parallel?: boolean | string;
    errors?: 'catch' | 'throw';
  };
}

export const DEFAULT_TRACE_CONFIG: TraceOptions<Array<unknown>, unknown>['config'] = {
  traceExecution: true,
  parallel: false,
  errors: 'throw'
};
