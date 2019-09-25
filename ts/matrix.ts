/// <reference path="util.ts" />
namespace manebu {
export class Mat {
    rows: number;
    cols: number;
    d: Float64Array[];

    constructor(rows: number, cols: number, d: number[]|undefined = undefined){
        this.rows = rows;
        this.cols = cols;
        this.d = range(rows).map(x => new Float64Array(cols));

        if(d != undefined){
            console.assert(rows * cols == d.length);

            for(let r = 0; r < rows; r++){
                for(let c = 0; c < cols; c++){
                    this.d[r][c] = d[r * cols + c];
                }
            }
        }
    }

    static Zero(n: number) : Mat {
        return new Mat(n,n);
    }

    static I(n: number) : Mat {
        const a = new Mat(n, n);

        for(let i = 0; i < n; i++){
            a.d[i][i] = 1;
        }

        return a;
    }

    print(s: string|undefined = undefined){
        if(s == undefined){

            msg(`[`)
        }
        else{

            msg(`${s} = [`)
        }

        for(let r = 0; r < this.rows; r++){
            msg(`\t[ ${range(this.cols).map(c => "" + this.d[r][c]).join(", ") } ]`);
        }
        msg(`]`)
    }

    map(f:(r:number) => number){
        const A = new Mat(this.rows, this.cols);

        for(let r = 0; r < this.rows; r++){
            for(let c = 0; c < this.cols; c++){

                A.d[r][c] = f(this.d[r][c]);
            }
        }

        return A;
    }

    map2(A: Mat, f:(x:number, y:number) => number){
        console.assert(this.rows == A.rows && this.cols == A.cols);

        const B = new Mat(this.rows, this.cols);

        for(let r = 0; r < this.rows; r++){
            for(let c = 0; c < this.cols; c++){

                B.d[r][c] = f(this.d[r][c], A.d[r][c]);
            }
        }

        return B;
    }

    reduce(f:(x:number, y:number) => number) : number {
        return range(this.rows).map(r => this.d[r].reduce(f)).reduce(f);
    }

    abs() : Mat {
        return this.map(x=>Math.abs(x));
    }

    max() : number {
        return this.reduce((x,y) => Math.max(x,y));
    }

    sub(A: Mat) : Mat {
        return this.map2(A, (x,y)=> x - y);
    }

    add(A: Mat) : Mat {
        return this.map2(A, (x,y)=> x + y);
    }

    t() : Mat {
        const A = new Mat(this.cols, this.rows);

        for(let r = 0; r < A.rows; r++){
            for(let c = 0; c < A.cols; c++){
                A.d[r][c] = this.d[c][r];
            }
        }

        return A;
    }

    dot(A: Mat) : Mat{
        console.assert(this.cols == A.rows);

        const B = new Mat(this.rows, A.cols);

        const C = A.t();
        
        for(let r = 0; r < this.rows; r++){
            for(let c = 0; c < A.cols; c++){
                let sum = 0;

                for(let k = 0; k < this.cols; k++){
                    // sum += this.d[r][k] * A.d[k][c];
                    sum += this.d[r][k] * C.d[c][k];
                }

                B.d[r][c] = sum;
            }
        }

        return B;
    }

    cat(a: Mat) : Mat {
        console.assert(this.rows == a.rows);

        const b = new Mat(this.rows, this.cols + a.cols)

        for(let r = 0; r < this.rows; r++){
            for(let c = 0; c < this.cols; c++){
                b.d[r][c] = this.d[r][c];
            }

            for(let c = 0; c < a.cols; c++){
                b.d[r][this.cols + c] = a.d[r][c];
            }
        }

        return b;
    }

    selectPivot(idx: number){
        let maxRow = idx;
        let maxVal = Math.abs(this.d[idx][idx]);
        
        for(let r = idx + 1; r < this.rows; r++){
            let val = Math.abs(this.d[r][idx]);

            if(maxVal < val){
                maxRow = r;
                maxVal = val;
            }
        }

        return maxRow;
    }

    swapRows(row1: number, row2: number){
        let tmp = this.d[row1];
        this.d[row1] = this.d[row2];
        this.d[row2] = tmp;
    }

    inv() : Mat {
        console.assert(this.rows == this.cols);

        const A = this.cat(Mat.I(this.rows));

        for(let r1 = 0; r1 < A.rows; r1++){
            if(r1 + 1 < A.rows){

                // ピボットの行を選ぶ。
                let r2 = A.selectPivot(r1);

                if(r2 != r1){
                    // ピボットの行が現在行と違う場合

                    // 行を入れ替える。
                    A.swapRows(r1, r2);
                }
            }

            // ピボットの逆数
            let  div = 1 / A.d[r1][r1];

            for(let c = 0; c < A.cols; c++){
                if(c == r1){
                    // 対角成分の場合

                    A.d[r1][c] = 1;
                }
                else{
                    // 対角成分でない場合

                    // ピボットの逆数をかける。
                    A.d[r1][c] *= div;
                }
            }

            for(let r2 = 0; r2 < this.rows; r2++){
                if(r2 != r1){
                    // ピボットの行でない場合

                    let a = - A.d[r2][r1];
                    A.d[r2][r1] = 0;
                    for(let c = r1 + 1; c < A.cols; c++){
                        A.d[r2][c] += a * A.d[r1][c];
                    }
                }
            }
        }
        
        const B = new Mat(this.rows, this.cols);

        for(let r = 0; r < this.rows; r++){
            B.d[r] = A.d[r].slice(this.cols);
        }

        return B;
    }
}
}