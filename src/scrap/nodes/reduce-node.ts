import {ParallelTaskNode, ParallelTaskNodeInput} from "./parallel-task-node";
import {Task} from "../tools/task";

export class ReduceNode<T> extends ParallelTaskNode<T[], T> {
    protected intervalRecords: [number, number][];

    constructor(props: ParallelTaskNodeInput<T[]>) {
        super(props, (): never => {
            throw new Error("ReduceNode does not use taskFunc")
        });
        this.intervalRecords = [];
    }

    getNodeTask(): Task<T[]> {
        if (!this.isPurePipeNode) {
            return new Task<T[]>(async resolve => {
                const input = await this.getInput();
                input.forEach((list, listIndex) => {
                    this.intervalRecords[listIndex] = [this.tasks.length, -1];
                    for (let i = 0; i < input.length; i++) {
                        const ele = list[i];
                        const l = this.tasks.length;
                        const singleTask = new Task<T>(async resolve1 => {
                            this.singleTaskDoneListener(singleTask, l);
                            resolve1(ele);
                        });
                        this.tasks.push(singleTask);
                    }
                    this.intervalRecords[listIndex][1] = this.tasks.length;
                });
                const result = await Promise.all(this.tasks);
                this.wholeTaskDoneListener(this.task);
                resolve(result);
            });
        } else if (this.inputPromises) {
            const promises = this.inputPromises;
            return new Task<T[]>(async resolve => {
                for (let listIndex = 0; listIndex < promises.length; listIndex++) {
                    let inputPromise = promises[listIndex];
                    const input = await inputPromise;
                    this.intervalRecords[listIndex] = [this.tasks.length, -1];
                    for (let i = 0; i < input.length; i++) {
                        const ele = input[i];
                        const l = this.tasks.length;
                        const singleTask = new Task<T>(async resolve1 => {
                            this.singleTaskDoneListener(singleTask, l);
                            resolve1(ele);
                        });
                        this.tasks.push(singleTask);
                    }
                    this.intervalRecords[listIndex][1] = this.tasks.length;
                }
                const result = await Promise.all(this.tasks);
                this.wholeTaskDoneListener(this.task);
                resolve(result);
            });
        } else {
            const previousParallelTaskNode = this.previousNode as ParallelTaskNode<any, T[]>;
            return new Task<T[]>(async resolve => {
                previousParallelTaskNode.onSingleTaskDone(async (task, listIndex) => {
                    const input = await task;
                    this.intervalRecords[listIndex] = [this.tasks.length, -1];
                    for (let i = 0; i < input.length; i++) {
                        const ele = input[i];
                        const l = this.tasks.length;
                        const singleTask = new Task<T>(async resolve1 => {
                            this.singleTaskDoneListener(singleTask, l);
                            resolve1(ele);
                        });
                        this.tasks.push(singleTask);
                    }
                    this.intervalRecords[listIndex][1] = this.tasks.length;
                });
                previousParallelTaskNode.onWholeTaskDone(async () => {
                    const result = await Promise.all(this.tasks);
                    this.wholeTaskDoneListener(this.task);
                    resolve(result);
                });
                previousParallelTaskNode.task.ensureStarted();
            });
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