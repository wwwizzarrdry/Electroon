# Electroon
Mini Roon controller with tray icon built with Electron

## Screenshots
![Splash](https://github.com/wwwizzarrdry/Electroon/blob/master/splashscreen.PNG)

![App](https://github.com/wwwizzarrdry/Electroon/blob/master/trayapp.PNG)



## Getting Started
```
1. Edit config.json and
   change "server_ip" to your Roon core address.
2. npm install
3. npm run build
4. npm start
5. Authorize extension in Roon
```
### If you npm install electron-packager, you can use the following to make an executable. 
*Once you edit your config.json, run electron-packer command from the project root directory
```
npm run package-win-asar
npm run package-mac
npm run package-linux-asar
```
Not sure how to package with the startup flags, but on Windows you can edit the .exe shortcut properties and append to the "target" like so:
```
--enable-transparent-visuals --disable-gpu
```
![Flags](https://github.com/wwwizzarrdry/Electroon/blob/master/flags.PNG)
  
