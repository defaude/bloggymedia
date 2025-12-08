# bloggymedia - Optimize media for blogging 

Optimize images and videos for blogging.

Run `bloggymedia` with an optional path (defaults to the current working directory) to
- ignore all files that are not image or video files (just leave them completely untouched)
- back up all the image and video files to a `.originals` subdirectory
- create optimized versions:
  - remove all metadata (EXIF, etc.)
  - use `mogrify` to reduce images to max 1200x1200 pixels
  - use `ffmpeg` (and related tools) to re-encode videos
    - maximum target resolution is 720p (1280x720 or 720x1280, depending on the video orientation)
    - output codec should always be H.264
    - output framerate capped at 24fps; higher-source files are downsampled to 24fps
    - orientation preserved; reruns skip files with existing backups
- run sequentially in the target folder only (no subdirectories), skipping files that already have backups in `.originals/<filename>`
- provide a nice CLI environment that shows the current progress and a summary (processed/skipped/failed filenames, no full paths)

```shell
bloggymedia
# or pass a specific folder
bloggymedia ./path/to/folder/with/media/files
```
