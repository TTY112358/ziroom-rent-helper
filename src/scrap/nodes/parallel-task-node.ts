import {ParalleledOutputNode, ParalleledOutputNodeInput} from "./pipeline-node";
import {NodeTask} from "../tools/task";

export type ParallelTaskNodeTaskFunc<TIn, TOut> = (a: TIn) => (Promise<TOut> | TOut);

export class ParallelTaskNode<TIn, TOut> extends ParalleledOutputNode<TIn, TOut> {

    protected readonly taskFunc: ParallelTaskNodeTaskFunc<TIn, TOut>;

    constructor(props: ParalleledOutputNodeInput<TIn>, taskFunc: ParallelTaskNodeTaskFunc<TIn, TOut>) {
        super(props);
        this.taskFunc = taskFunc;
    }

    getNodeTask(): NodeTask<TOut[]> {
        const promiseLike2Task = (ele: TIn | Promise<TIn>, eleIndex: number) => {
            const previousTask = ele instanceof NodeTask ? ele : this.previousNode?.task;
            let resolveFunc: Function;
            this.emitTasks[eleIndex] = new Promise<void>(resolve => resolveFunc = resolve);
            const singleTask = new NodeTask<TOut>(async resolve1 => {
                const result = await this.taskFunc(await ele);
                setImmediate(() => {
                    this.singleTaskDoneListeners.forEach(l => l(singleTask, eleIndex));
                    resolveFunc();
                });
                resolve1(result);
            }, this, previousTask, eleIndex);
            return singleTask;
        };

        const getResultAfterTaskSet = async () => {
            const result = await Promise.all(this.tasks);
            await Promise.all(this.emitTasks);
            setImmediate(() => {
                this.wholeTaskDoneListeners.forEach(l => l(this.task));
            });
            return result;
        }
        if (!this.isPurePipeNode) {
            return new NodeTask<TOut[]>(async resolve => {
                const input = await this.getInput();
                this.tasks = input.map(promiseLike2Task);
                const result = await getResultAfterTaskSet();
                resolve(result);
            }, this, this.previousNode?.task);
        } else if (this.inputPromises) {
            this.tasks = this.inputPromises.map(promiseLike2Task);
            return new NodeTask<TOut[]>(async resolve => {
                const result = await getResultAfterTaskSet();
                resolve(result);
            }, this, this.previousNode?.task);
        } else {
            const previousParallelOutputNode = this.previousNode as ParalleledOutputNode<any, TIn>;
            previousParallelOutputNode.onSingleTaskDone((task, index) => {
                this.tasks[index] = promiseLike2Task(task, index);
            });
            return new NodeTask<TOut[]>(async resolve => {
                await previousParallelOutputNode.task;
                const result = await getResultAfterTaskSet();
                resolve(result);
            }, this, this.previousNode?.task);
        }
    }
}