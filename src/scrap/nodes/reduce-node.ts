import {ParallelTaskNode, ParallelTaskNodeInput} from "./parallel-task-node";
import {Task} from "../tools/task";

export class ReduceNode<T> extends ParallelTaskNode<T[], T> {
    listOfList: T[][];

    constructor(props: ParallelTaskNodeInput<T[]>) {
        super(props, (): never => {
            throw new Error("ReduceNode does not use taskFunc")
        });
        this.listOfList = [];
    }

    getNodeTask(): Task<T[]> {
        if (!this.isPurePipeNode) {
            return new Task<T[]>(async resolve => {
                const input = await this.getInput();
                input.forEach((list, listIndex) => {
                    this.listOfList[listIndex] = [];
                    for (let i = 0; i < input.length; i++) {
                        const ele = list[i];
                        const l = this.tasks.length;
                        const singleTask = new Task<T>(async resolve1 => {
                            this.singleTaskDoneListener(singleTask, l);
                            this.listOfList[listIndex][i] = ele;
                            resolve1(ele);
                        });
                        this.tasks.push(singleTask);
                    }
                });
                await Promise.all(this.tasks);
                this.wholeTaskDoneListener(this.task);
                resolve(this.listOfList.reduce((p, v) => [...p, ...v], []));
            });
        } else if (this.inputPromises) {
            const promises = this.inputPromises;
            return new Task<T[]>(async resolve => {
                for (let listIndex = 0; listIndex < promises.length; listIndex++) {
                    let inputPromise = promises[listIndex];
                    const input = await inputPromise;
                    this.listOfList[listIndex] = [];
                    for (let i = 0; i < input.length; i++) {
                        const ele = input[i];
                        const l = this.tasks.length;
                        const singleTask = new Task<T>(async resolve1 => {
                            this.singleTaskDoneListener(singleTask, l);
                            this.listOfList[listIndex][i] = ele;
                            resolve1(ele);
                        });
                        this.tasks.push(singleTask);
                    }
                }
                await Promise.all(this.tasks);
                this.wholeTaskDoneListener(this.task);
                resolve(this.listOfList.reduce((p, v) => [...p, ...v], []));
            });
        } else {
            const previousParallelTaskNode = this.previousNode as ParallelTaskNode<any, T[]>;
            return new Task<T[]>(async resolve => {
                previousParallelTaskNode.onSingleTaskDone(async (task, listIndex) => {
                    const input = await task;
                    this.listOfList[listIndex] = [];
                    for (let i = 0; i < input.length; i++) {
                        const ele = input[i];
                        const l = this.tasks.length;
                        const singleTask = new Task<T>(async resolve1 => {
                            this.singleTaskDoneListener(singleTask, l);
                            this.listOfList[listIndex][i] = ele;
                            resolve1(ele);
                        });
                        this.tasks.push(singleTask);
                    }
                });
                previousParallelTaskNode.onWholeTaskDone(async () => {
                    this.wholeTaskDoneListener(this.task);
                    await Promise.all(this.tasks);
                    resolve(this.listOfList.reduce((p, v) => [...p, ...v], []));
                });
                previousParallelTaskNode.task.ensureStarted();
            });
        }
    }
}