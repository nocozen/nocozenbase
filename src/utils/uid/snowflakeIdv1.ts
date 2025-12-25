import { snowflakeIdv1Option } from "./snowflakeIdv1Option.js"

export  class snowflakeIdv1 {
    private Method
    private BaseTime
    private WorkerId
    private WorkerIdBitLength
    private SeqBitLength
    private MaxSeqNumber
    private MinSeqNumber
    private TopOverCostCount
    private _TimestampShift
    private _CurrentSeqNumber
    private _LastTimeTick: bigint
    private _TurnBackTimeTick: bigint
    private _TurnBackIndex
    private _IsOverCost
    private _OverCostCountInOneTerm

    constructor(options: snowflakeIdv1Option) {
        if (options.workerId === undefined)
            throw new Error("lost WorkerId")

        const BaseTime = 1577836800000
        if (!options.baseTime || options.baseTime < 0)
            options.baseTime = BaseTime

        const WorkerIdBitLength = 6
        if (!options.workerIdBitLength || options.workerIdBitLength < 0)
            options.workerIdBitLength = WorkerIdBitLength

        const SeqBitLength = 6
        if (!options.seqBitLength || options.seqBitLength < 0)
            options.seqBitLength = SeqBitLength

        if (options.maxSeqNumber == undefined || options.maxSeqNumber <= 0)
            options.maxSeqNumber = (1 << SeqBitLength) - 1

        const MinSeqNumber = 5
        if (options.minSeqNumber == undefined || options.minSeqNumber < 0)
            options.minSeqNumber = MinSeqNumber

        const topOverCostCount = 2000
        if (options.topOverCostCount == undefined || options.topOverCostCount < 0)
            options.topOverCostCount = topOverCostCount


        if (options.method !== 2)
            options.method = 1
        else
            options.method = 2

        this.Method = BigInt(options.method)
        this.BaseTime = BigInt(options.baseTime)
        this.WorkerId = BigInt(options.workerId)
        this.WorkerIdBitLength = BigInt(options.workerIdBitLength)
        this.SeqBitLength = BigInt(options.seqBitLength)
        this.MaxSeqNumber = BigInt(options.maxSeqNumber)
        this.MinSeqNumber = BigInt(options.minSeqNumber)
        this.TopOverCostCount = BigInt(options.topOverCostCount)

        const timestampShift = this.WorkerIdBitLength + this.SeqBitLength
        const currentSeqNumber = this.MinSeqNumber

        this._TimestampShift = timestampShift
        this._CurrentSeqNumber = currentSeqNumber

        this._LastTimeTick = BigInt(0)
        this._TurnBackTimeTick = BigInt(0)
        this._TurnBackIndex = 0
        this._IsOverCost = false
        this._OverCostCountInOneTerm = 0
    }

    private BeginOverCostAction(useTimeTick: any) {
    }

    private EndOverCostAction(useTimeTick: any) {
        // if m1._TermIndex > 10000 {
        //     m1._TermIndex = 0
        // }
    }

    private BeginTurnBackAction(useTimeTick: any) {

    }

    private EndTurnBackAction(useTimeTick: any) {

    }


    private NextOverCostId(): bigint {
        const currentTimeTick = this.GetCurrentTimeTick()
        if (currentTimeTick > this._LastTimeTick) {
            this.EndOverCostAction(currentTimeTick)
            this._LastTimeTick = currentTimeTick
            this._CurrentSeqNumber = this.MinSeqNumber
            this._IsOverCost = false
            this._OverCostCountInOneTerm = 0
            // this._GenCountInOneTerm = 0
            return this.CalcId(this._LastTimeTick)
        }
        if (this._OverCostCountInOneTerm >= this.TopOverCostCount) {
            this.EndOverCostAction(currentTimeTick)
            this._LastTimeTick = this.GetNextTimeTick()
            this._CurrentSeqNumber = this.MinSeqNumber
            this._IsOverCost = false
            this._OverCostCountInOneTerm = 0
            // this._GenCountInOneTerm = 0
            return this.CalcId(this._LastTimeTick)
        }
        if (this._CurrentSeqNumber > this.MaxSeqNumber) {
            this._LastTimeTick++
            this._CurrentSeqNumber = this.MinSeqNumber
            this._IsOverCost = true
            this._OverCostCountInOneTerm++
            // this._GenCountInOneTerm++

            return this.CalcId(this._LastTimeTick)
        }

        // this._GenCountInOneTerm++
        return this.CalcId(this._LastTimeTick)
    }

    private NextNormalId() {
        const currentTimeTick = this.GetCurrentTimeTick()
        if (currentTimeTick < this._LastTimeTick) {
            if (this._TurnBackTimeTick < 1) {
                this._TurnBackTimeTick = this._LastTimeTick - BigInt(1)
                this._TurnBackIndex++
                if (this._TurnBackIndex > 4)
                    this._TurnBackIndex = 1
                this.BeginTurnBackAction(this._TurnBackTimeTick)
            }

            return this.CalcTurnBackId(this._TurnBackTimeTick)
        }
        
        if (this._TurnBackTimeTick > 0) {
            this.EndTurnBackAction(this._TurnBackTimeTick)
            this._TurnBackTimeTick = BigInt(0)
        }

        if (currentTimeTick > this._LastTimeTick) {
            this._LastTimeTick = currentTimeTick
            this._CurrentSeqNumber = this.MinSeqNumber
            return this.CalcId(this._LastTimeTick)
        }

        if (this._CurrentSeqNumber > this.MaxSeqNumber) {
            this.BeginOverCostAction(currentTimeTick)
            // this._TermIndex++
            this._LastTimeTick++
            this._CurrentSeqNumber = this.MinSeqNumber
            this._IsOverCost = true
            this._OverCostCountInOneTerm = 1
            // this._GenCountInOneTerm = 1

            return this.CalcId(this._LastTimeTick)
        }

        return this.CalcId(this._LastTimeTick)
    }

    private CalcId(useTimeTick: bigint) {
        const result = BigInt(useTimeTick << this._TimestampShift) + BigInt(this.WorkerId << this.SeqBitLength) + BigInt(this._CurrentSeqNumber)
        this._CurrentSeqNumber++
        return result
    }

    private CalcTurnBackId(useTimeTick: any) {
        const result = BigInt(useTimeTick << this._TimestampShift) + BigInt(this.WorkerId << this.SeqBitLength) + BigInt(this._TurnBackIndex)
        this._TurnBackTimeTick--
        return result
    }

    private GetCurrentTimeTick() {
        const millis = BigInt((new Date()).valueOf())
        return millis - this.BaseTime
    }

    private GetNextTimeTick() {
        let tempTimeTicker = this.GetCurrentTimeTick()
        while (tempTimeTicker <= this._LastTimeTick) {
            tempTimeTicker = this.GetCurrentTimeTick()
        }
        return tempTimeTicker
    }

    public NextNumber(): number {
        if (this._IsOverCost) {
            //
            let id = this.NextOverCostId()
            if (id >= 9007199254740992n)
                throw Error(`${id.toString()} over max of Number 9007199254740992`)

            return parseInt(id.toString())
        } else {
            //
            let id = this.NextNormalId()
            if (id >= 9007199254740992n)
                throw Error(`${id.toString()} over max of Number 9007199254740992`)

            return parseInt(id.toString())
        }
    }

    public NextId(): number | bigint {
        if (this._IsOverCost) {
            //
            let id = this.NextOverCostId()
            if (id >= 9007199254740992n)
                return id
            else
                return parseInt(id.toString())
        } else {
            //
            let id = this.NextNormalId()
            if (id >= 9007199254740992n)
                return id
            else
                return parseInt(id.toString())
        }
    }

    public NextBigId(): bigint {
        if (this._IsOverCost) {
            //
            return this.NextOverCostId()
        } else {
            //
            return this.NextNormalId()
        }
    }
}

