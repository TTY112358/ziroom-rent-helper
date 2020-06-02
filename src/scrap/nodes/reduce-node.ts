import {ParallelTaskNode} from "./parallel-task-node";
import {NodeTask} from "../tools/task";
import {ParalleledOutputNode, ParalleledOutputNodeInput} from "./pipeline-node";

export class ReduceNode<T> extends ParallelTaskNode<T[], T> {
    protected intervalRecords: [number, number][];
    private hyperTasks: Promise<void>[];

    constructor(props: ParalleledOutputNodeInput<T[]>) {
        super(props, (): never => {
            throw new Error("ReduceNode does not use taskFunc")
        });
        this.intervalRecords = [];
        this.hyperTasks = [];
    }

    getNodeTask(): NodeTask<T[]> {
        const promiseLike2HyperTask = (list: T[] | Promise<T[]>, listIndex: number) => {
            const previousTask = list instanceof NodeTask ? list : this.previousNode?.task;
            return new Promise<void>(async resolve => {
                const input = await list;
                this.intervalRecords[listIndex] = [this.tasks.length, -1];
                input.forEach((item, itemIndex) => {
                    const len = this.tasks.length;
                    let resolveFunc: Function;
                    const emitTask = new Promise<void>(resolve => resolveFunc = resolve);
                    const singleTask = new NodeTask<T>(resolve1 => {
                        setImmediate(() => {
                            this.singleTaskDoneListeners.forEach(l => l(singleTask, len));
                            resolveFunc();
                        });
                        resolve1(item);
                    }, this, previousTask, itemIndex);
                    this.tasks.push(singleTask);
                    this.emitTasks.push(emitTask);
                });
                this.intervalRecords[listIndex][1] = this.tasks.length;
                resolve();
            });
        };
        const getResultAfterHyperTasksSet = async ()=>{
            await Promise.all(this.hyperTasks);
            const result = await Promise.all(this.tasks);
            await Promise.all(this.emitTasks);
            setImmediate(() => {
                this.wholeTaskDoneListeners.forEach(l => l(this.task));
            });
            return result;
        };
        if (!this.isPurePipeNode) {
            return new NodeTask<T[]>(async resolve => {
                const input = await this.getInput();
                this.hyperTasks = input.map(promiseLike2HyperTask);
                const result = await getResultAfterHyperTasksSet();
                resolve(result);
            }, this, this.previousNode?.task);
        } else if (this.inputPromises) {
            const promises = this.inputPromises;
            return new NodeTask<T[]>(async resolve => {
                this.hyperTasks = promises.map(promiseLike2HyperTask);
                const result = await getResultAfterHyperTasksSet();
                resolve(result);
            }, this, this.previousNode?.task);
        } else {
            const previousParallelOutputNode = this.previousNode as ParalleledOutputNode<any, T[]>;
            return new NodeTask<T[]>(async resolve => {
                previousParallelOutputNode.onSingleTaskDone((task, taskIndex) => {
                    this.hyperTasks.push(promiseLike2HyperTask(task, taskIndex));
                });
                previousParallelOutputNode.onWholeTaskDone(async () => {
                    await previousParallelOutputNode.task;
                    const result = await getResultAfterHyperTasksSet();
                    resolve(result);
                });
                previousParallelOutputNode.task.ensureStarted();
            }, this, this.previousNode?.task);
        }
    }

    async getReorderFunction(): Promise<(arr: []) => []> {
        let previousReorderFunction: (arr: []) => [];
        if (this.previousNode) {
            previousReorderFunction = await this.previousNode.getReorderFunction();
        } else {
            previousReorderFunction = (arr: []) => [...arr];
        }
        await this.task;
        return (arr) => {
            const intervalRecords: [number, number][] = previousReorderFunction(this.intervalRecords as []);
            const records = intervalRecords.map(([start, end]) => {
                return new Array(end - start).fill(null).map((a, index) => start + index);
            }).reduce((p, v) => [...p, ...v], []);
            const reverseRecords = records.map((a, index) => records.findIndex(i => i === index));
            return arr.reduce((p, v, index) => {
                p[reverseRecords[index]] = v;
                return p;
            }, []);
        };
    }
}