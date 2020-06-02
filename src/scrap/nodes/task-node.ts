import {PipelineNode, PipelineNodeInput} from "./pipeline-node";
import {NodeTask, Task} from "../tools/task";

export class TaskNode<TIn, TOut> extends PipelineNode<TIn, TOut> {
    protected readonly taskFunc: (a: TIn) => (Promise<TOut> | TOut);

    constructor(props: PipelineNodeInput<TIn>, taskFunc: (a: TIn) => (TOut | Promise<TOut>)) {
        super(props);
        this.taskFunc = taskFunc;
    }

    getNodeTask(): NodeTask<TOut> {
        return new NodeTask<TOut>(async (resolve, reject) => {
            try {
                const input = await this.getInput();
                const result = await this.taskFunc(input);
                resolve(result);
            } catch (e) {
                reject(e);
            }
        }, this, this.previousNode?.task);
    }
}