import {PipelineNode, PipelineNodeInput} from "./pipeline-node";

export class TaskNode<TIn, TOut> extends PipelineNode<TIn, TOut> {
    constructor(props: PipelineNodeInput<TIn>, taskFunc: (a: TIn) => (TOut | Promise<TOut>)) {
        super(props);
        this.runInternal = async (input) => taskFunc(input);
    }
}