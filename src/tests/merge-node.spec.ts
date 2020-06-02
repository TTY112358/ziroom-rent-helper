import {ParallelTaskNode} from "../scrap/nodes/parallel-task-node";
import {MergeNode} from "../scrap/nodes/merge-node";
import {ParallelMergeNode} from "../scrap/nodes/parallel-merge-node";
import {ReduceNode} from "../scrap/nodes/reduce-node";

async function sleep(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function zip<T>(listOfList: T[][]): T[][] {
    const len = listOfList[0].length;
    const toReturn = [];
    for (let i = 0; i < len; i++) {
        const toPush = [];
        for (const list of listOfList) {
            toPush.push(list[i]);
        }
        toReturn.push(toPush);
    }
    return toReturn;
}

test("merge-node", async done => {
    const n = new ParallelTaskNode({input: [1, 2, 3]}, async (c) => {
        const sleepTime = Math.floor(Math.random() * 500);
        await sleep(sleepTime);
        return c;
    });
    const nodes = [1, 2, 3, 4, 5].map(num => new ParallelTaskNode({previousNode: n}, async (c) => {
        const sleepTime = Math.floor(Math.random() * 500);
        await sleep(sleepTime);
        return c * num;
    }));
    const mergeNode = new MergeNode({
        sources: [
            ...nodes.map(node => ({previousNode: node})),
            {input: [10, 11, 12]},
            {
                inputPromise: new Promise<number[]>(resolve => {
                    sleep(500);
                    resolve([21, 22, 25]);
                })
            },
        ],
    }, zip);

    const output = await mergeNode.getOutput();
    console.log(output);
    done();
});

test("parallel-merge-node", async done => {
    const n = new ParallelTaskNode({input: [1, 2, 3]}, async (c) => {
        const sleepTime = Math.floor(Math.random() * 500);
        await sleep(sleepTime);
        return c;
    });
    const nodes = [1, 2, 3, 4, 5].map(num => new ParallelTaskNode({previousNode: n}, async (c) => {
        const sleepTime = Math.floor(Math.random() * 500);
        await sleep(sleepTime);
        return c * num;
    }));
    const mergeNode = new ParallelMergeNode({
        sources: [
            {previousNode: nodes[0]},
            {previousNode: nodes[1]},
            {previousNode: nodes[4]},
            {input: [10, 11, 12]},
            {
                inputPromise: new Promise<number[]>(resolve => {
                    sleep(500);
                    resolve([21, 22, 25]);
                })
            },
        ],
    }, async numbers => {
        const sleepTime = Math.floor(Math.random() * 500);
        await sleep(sleepTime);
        return numbers.join(",");
    });

    const output = await mergeNode.getOutput();
    console.log(output);
    done();
});