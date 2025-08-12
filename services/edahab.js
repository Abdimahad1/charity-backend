// TODO: integrate E-Dahab provider here.
// For now we just throw so the controller can respond gracefully.
module.exports = {
    payByEDahab: async () => {
      throw Object.assign(new Error('E-Dahab integration not yet configured'), { status: 501 });
    },
    mapEDahabStatus: () => 'pending'
  };
  