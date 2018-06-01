import timeout from './timeout';

export default {
  fixed(ms) {
    return () => timeout(ms);
  },

  relative(ratio) {
    return (reqTimestamp, resTimestamp) =>
      timeout(
        ratio *
          (new Date(resTimestamp).getTime() - new Date(reqTimestamp).getTime())
      );
  }
};
