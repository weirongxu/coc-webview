/* eslint-disable @typescript-eslint/no-var-requires */
const alias = require('esbuild-plugin-alias');
const path = require('path');

async function start(watch) {
  await require('esbuild').build({
    entryPoints: {
      index: 'src/index.ts',
      client: 'src/client/index.ts',
    },
    bundle: true,
    watch,
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development',
    mainFields: ['module', 'main'],
    external: ['coc.nvim', '@shd101wyy/mume'],
    platform: 'node',
    target: 'node10.12',
    outdir: 'lib',
    plugins: [
      alias({
        'socket.io-client': path.join(__dirname, 'node_modules/socket.io-client/dist/socket.io.min.js'),
      }),
    ],
  });
}

let watch = false;
if (process.argv.length > 2 && process.argv[2] === '--watch') {
  console.log('watching...');
  watch = {
    onRebuild(error) {
      if (error) {
        console.error('watch build failed:', error);
      } else {
        console.log('watch build succeeded');
      }
    },
  };
}

start(watch).catch((e) => {
  console.error(e);
});
