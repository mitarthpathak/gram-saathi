/* global AudioWorkletProcessor, registerProcessor */

class LiveCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(2048);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel?.length) return true;
    let sourceOffset = 0;
    while (sourceOffset < channel.length) {
      const count = Math.min(channel.length - sourceOffset, this.chunk.length - this.offset);
      this.chunk.set(channel.subarray(sourceOffset, sourceOffset + count), this.offset);
      sourceOffset += count;
      this.offset += count;
      if (this.offset === this.chunk.length) {
        const completed = this.chunk;
        this.chunk = new Float32Array(2048);
        this.offset = 0;
        this.port.postMessage(completed, [completed.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('gram-saathi-live-capture', LiveCaptureProcessor);
