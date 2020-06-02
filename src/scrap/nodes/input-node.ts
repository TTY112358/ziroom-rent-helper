import {PipelineNode, PipelineNodeInput} from "./pipeline-node";
import {NodeTask} from "../tools/task";

export interface OutputParalleled<TOut> {
    singleTaskDoneListeners: ((singleTask: NodeTask<TOut>, eleIndex: number) => void)[];
    wholeTaskDoneListeners: ((wholeTask: NodeTask<TOut[]>) => void)[];
    onSingleTaskDone: (listener: (singleTask: NodeTask<TOut>, eleIndex: number) => void)=>void;
    onWholeTaskDone: (listener: (wholeTask: NodeTask<TOut[]>) => void)=>void;
}
export type InputNodeInput<T> = {
    name?: string,
    previousNode?: PipelineNode<any, T>,
    input?: T,
    inputPromise?: Promise<T>,
};

// export class InputNode<TOut> extends PipelineNode<TOut, TOut> implements OutputParalleled<TOut>{
//     constructor(props: PipelineNodeInput< TOut>) {
//         super(props);
//     }
//
//     getNodeTask(): NodeTask<TOut> {
//         return undefined;
//     }
// }