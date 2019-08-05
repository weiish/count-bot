const Canvas = require("canvas");

const getImageBuffer = async () => {
  const canvas = Canvas.createCanvas(700, 250);
  const ctx = canvas.getContext("2d");
  const background = await Canvas.loadImage("./imgs/246x0w.jpg");
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#74037b";
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  return canvas.toBuffer();
};

const getChartBuffer = async (configuration) => {
  const { CanvasRenderService } = require("chartjs-node-canvas");
  const width = 400;
  const height = 300;
  const grid_line_color = "rgba("
  const chartCallback = ChartJS => {
    // Global config example: https://www.chartjs.org/docs/latest/configuration/
    ChartJS.defaults.global.elements.rectangle.borderWidth = 2;
    ChartJS.defaults.global.defaultFontColor = 'white';
    // Global plugin example: https://www.chartjs.org/docs/latest/developers/plugins.html
    ChartJS.plugins.register({
      // plugin implementation
    });
    // New chart type example: https://www.chartjs.org/docs/latest/developers/charts.html
    ChartJS.controllers.MyType = ChartJS.DatasetController.extend({
      // chart implementation
    });
  };
  const canvasRenderService = new CanvasRenderService(
      width,
      height,
      chartCallback
    );
  const image = await canvasRenderService.renderToBuffer(configuration);
  return image
};

module.exports = {
  getImageBuffer,
  getChartBuffer
};

// For functions that generate results images
