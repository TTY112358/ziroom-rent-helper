import {ParallelTaskNode} from "./parallel-task-node";
import {NodeTask} from "../tools/task";
import {ParalleledOutputNodeInput} from "./pipeline-node";

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
                    const singleTask = new NodeTask<T>(async resolve1 => {
                        this.singleTaskDoneListeners.forEach(l => l(singleTask, len));
                        resolve1(item);
                    }, this, previousTask, itemIndex);
                    this.tasks.push(singleTask);
                });
                this.intervalRecords[listIndex][1] = this.tasks.length;
                resolve();
            });
        };
        if (!this.isPurePipeNode) {
            return new NodeTask<T[]>(async resolve => {
                const input = await this.getInput();
                this.hyperTasks = input.map(promiseLike2HyperTask);
                await Promise.all(this.hyperTasks);
                const result = await Promise.all(this.tasks);
                this.wholeTaskDoneListeners.forEach(l => l(this.task));
                resolve(result);
            }, this, this.previousNode?.task);
        } else if (this.inputPromises) {
            const promises = this.inputPromises;
            return new NodeTask<T[]>(async resolve => {
                this.hyperTasks = promises.map(promiseLike2HyperTask);
                await Promise.all(this.hyperTasks);
                const result = await Promise.all(this.tasks);
                this.wholeTaskDoneListeners.forEach(l => l(this.task));
                resolve(result);
            }, this, this.previousNode?.task);
        } else {
            const previousParallelTaskNode = this.previousNode as ParallelTaskNode<any, T[]>;
            return new NodeTask<T[]>(async resolve => {
                previousParallelTaskNode.onSingleTaskDone((task, taskIndex) => {
                    this.hyperTasks.push(promiseLike2HyperTask(task, taskIndex));
                });
                previousParallelTaskNode.onWholeTaskDone(async () => {
                    await Promise.all(this.hyperTasks);
                    const result = await Promise.all(this.tasks);
                    this.wholeTaskDoneListeners.forEach(l => l(this.task));
                    resolve(result);
                });
                previousParallelTaskNode.task.ensureStarted();
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