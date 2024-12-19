

export async function sequence (array: Function[]) {
    let all = new Promise((resolve) => {
        setTimeout(() => {
            resolve(null);
        }, 1);
    });

    array.forEach(a => {
        all = all.then(async () => {
            await a();
        });
    })

    return all;
}

