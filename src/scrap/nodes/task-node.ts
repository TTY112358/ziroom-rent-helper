import {PipelineNode, PipelineNodeInput} from "./pipeline-node";
import {Task} from "../tools/task";

export class TaskNode<TIn, TOut> extends PipelineNode<TIn, TOut> {
    private readonly taskFunc: (a: TIn) => (Promise<TOut> | TOut);

    constructor(props: PipelineNodeInput<TIn>, taskFunc: (a: TIn) => (TOut | Promise<TOut>)) {
        super(props);
        this.taskFunc = taskFunc;
    }

    getNodeTask(): Task<TOut> {
        return new Task<TOut>(async (resolve, reject) => {
            try {
                const input = await this.getInput();
                const result = await this.taskFunc(input);
                resolve(result);
            } catch (e) {
                reject(e);
            }
        });
    }
}