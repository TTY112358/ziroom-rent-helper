import {PipelineNode, PipelineNodeInput} from "./pipeline-node";
import {NodeTask} from "../tools/task";
import {TaskNode} from "./task-node";

namespace MergeNode {
    export type Props<TInTuple> = { name?: string, sources: { [K in keyof TInTuple]: Omit<PipelineNodeInput<TInTuple[K]>, 'name'> } };
    export type Sources<T> = {
        previousNode: null | PipelineNode<any, T>;
        input: null | T;
        inputPromise: null | Promise<T>;
    }
}

export class MergeNode<TInTuple extends any[], TOut=any> extends TaskNode<TInTuple, TOut> {
    protected sources: MergeNode.Sources<TInTuple[keyof TInTuple]>[];

    constructor(props: MergeNode.Props<TInTuple>, taskFunc: (a: TInTuple) => TOut | Promise<TOut>) {
        super(props, taskFunc);
        this.sources = props.sources.map(source => ({
            previousNode: source.previousNode || null,
            input: source.input || null,
            inputPromise: source.inputPromise || null,
        }));
    }

    async getInput(): Promise<TInTuple> {
        const input = [];
        for (const source of this.sources) {
            if (source.previousNode) {
                input.push(await source.previousNode.getOutput());
            } else if (source.input) {
                input.push(source.input);
            } else if (source.inputPromise) {
                input.push(await source.inputPromise);
            } else {
                throw new Error("no input for merge node");
            }
        }
        return input as TInTuple;
    }

    getNodeTask(): NodeTask<TOut> {
        return new NodeTask<TOut>(async resolve => {
            const input = await this.getInput();
            const result = await this.taskFunc(input);
            resolve(result);
        }, this, null);
    }

}