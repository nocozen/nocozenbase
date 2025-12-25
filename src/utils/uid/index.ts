import { snowflakeIdv1 } from './snowflakeIdv1.js';
import config from '../../utils/config.js';

const WorkerId = config.http.workerId == undefined ? 1 : config.http.workerId
export class Uidv1 {
  private static instance: snowflakeIdv1;

  constructor() {}

  public static getInstance() {
    if (!this.instance) {
      this.instance = new snowflakeIdv1({ workerId: WorkerId });
    }
    return this.instance;
  }
}

const uidv1 = Uidv1.getInstance();

export default uidv1;
