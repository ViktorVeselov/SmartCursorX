export default class ElectronStore {
  constructor() {
    this.data = {};
  }
  get(key) {
    return this.data[key] !== undefined ? this.data[key] : null;
  }
  set(key, val) {
    this.data[key] = val;
  }
  delete(key) {
    delete this.data[key];
  }
}
