# bloggymedia - Optimize media for blogging 

Optimize images and videos for blogging.

Given a path as parameter, this command will
- ignore all files that are not image or video files (just leave them completely untouched)
- back up all the image and video files to a `.originals` subdirectory
- create optimized versions:
  - remove all metadata (EXIF, etc.)
  - use `mogrify` to reduce images to max 1200x1200 pixels
  - use `ffmpeg` (and related tools) to re-encode videos
    - maximum target resolution is 720p (1280x720 or 720x1280, depending on the video orientation)
    - output codec should always be H.264
- provide a nice CLI environment that shows the current progress

```shell
bloggymedia ./path/to/folder/with/media/files
```
