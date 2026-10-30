// pm2 setup — use this if you do NOT have root.
//
//   npm install -g pm2          (or: npx pm2 ...)
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save                    # remember the process list
//   pm2 startup                 # prints a command; if you can't run it (no
//                               # sudo), add `@reboot pm2 resurrect` to your
//                               # crontab instead: crontab -e
//   pm2 logs qa-scanner         # logs
module.exports = {
  apps: [
    {
      name: 'qa-scanner',
      script: 'server/index.js',
      cwd: __dirname + '/..',
      instances: 1,
      autorestart: true,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
