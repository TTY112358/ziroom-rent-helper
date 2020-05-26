import {PipelineNode, PipelineNodeInput} from "./pipeline-node";
import {Task} from "../tools/task";

export type ParallelTaskNodeInput<TIn> = PipelineNodeInput<TIn[]> & {
    inputPromises?: Promise<TIn>[]
};
export type ParallelTaskNodeTaskFunc<TIn, TOut> = (a: TIn) => (Promise<TOut> | TOut);

export class ParallelTaskNode<TIn, TOut> extends PipelineNode<TIn[], TOut[]> {
    inputPromises: Promise<TIn>[] | null;
    tasks: Task<TOut>[];
    protected singleTaskDoneListener: (singleTask: Task<TOut>, eleIndex: number) => void;
    protected wholeTaskDoneListener: (wholeTask: Task<TOut[]>) => void;
    protected readonly taskFunc: ParallelTaskNodeTaskFunc<TIn, TOut>;

    constructor(props: ParallelTaskNodeInput<TIn>, taskFunc: ParallelTaskNodeTaskFunc<TIn, TOut>) {
        super(props);
        this.inputPromises = null;
        if (!this.previousNode && !this.input && !this.inputPromise && props.inputPromises) {
            this.inputPromises = props.inputPromises;
            this.task = this.getNodeTask();
        }
        this.taskFunc = taskFunc;
        this.singleTaskDoneListener = () => {
        };
        this.wholeTaskDoneListener = () => {
        };
        this.tasks = [];
    }

    protected get isPurePipeNode(): boolean {
        return (!!this.inputPromises) || (!!this.previousNode) && (this.previousNode instanceof ParallelTaskNode);
    }

    getNodeTask(): Task<TOut[]> {
        if (!this.isPurePipeNode) {
            return new Task<TOut[]>(async resolve => {
                const input = await this.getInput();
                this.tasks = input.map((ele, eleIndex) => {
                    const singleTask = new Task<TOut>(async resolve1 => {
                        const result = await this.taskFunc(ele);
                        this.singleTaskDoneListener(singleTask, eleIndex);
                        resolve1(result);
                    });
                    return singleTask;
                });
                const result = await Promise.all(this.tasks);
                this.wholeTaskDoneListener(this.task);
                resolve(result);
            });
        } else if (this.inputPromises) {
            this.tasks = this.inputPromises.map((inputPromise, index) => {
                const singleTask = new Task<TOut>(async resolve => {
                    const input = await inputPromise;
                    const result = await this.taskFunc(input);
                    this.singleTaskDoneListener(singleTask, index);
                    resolve(result);
                });
                return singleTask;
            });
            return new Task<TOut[]>(async resolve => {
                const result = await Promise.all(this.tasks);
                this.wholeTaskDoneListener(this.task);
                resolve(result);
            });
        } else {
            const previousParallelTaskNode = this.previousNode as ParallelTaskNode<any, TIn>;
            previousParallelTaskNode.onSingleTaskDone((task, index) => {
                const singleTask = new Task<TOut>(async resolve => {
                    const input = await task;
                    const result = await this.taskFunc(input);
                    this.singleTaskDoneListener(singleTask, index);
                    resolve(result);
                });
                this.tasks[index] = singleTask;
            });
            return new Task<TOut[]>(async resolve => {
                await previousParallelTaskNode.task;
                const result = await Promise.all(this.tasks);
                this.wholeTaskDoneListener(this.task);
                resolve(result);
            });
        }
    }

    onSingleTaskDone(listener: (singleTask: Task<TOut>, eleIndex: number) => void) {
        this.singleTaskDoneListener = listener;
    }

    onWholeTaskDone(listener: (wholeTask: Task<TOut[]>) => void) {
        this.wholeTaskDoneListener = listener;
    }
}