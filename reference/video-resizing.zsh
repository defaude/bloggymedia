#!/bin/zsh

# Function: check_and_scale_video
# Usage: check_and_scale_video <video_file>
# Checks if the video needs to be scaled down or re-encoded, and prints the ffmpeg command if needed.
check_and_scale_video() {
    local file="$1"
    local out_file="$2"

    if [[ ! -f "$file" ]]; then
        echo "File not found: $file"
        return 1
    fi

    # Get video stream info using ffprobe
    local info
    info=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1:nokey=1 "$file")
    local codec width height fps
    codec=$(echo "$info" | sed -n '1p')
    width=$(echo "$info" | sed -n '2p')
    height=$(echo "$info" | sed -n '3p')
    fps=$(echo "$info" | sed -n '4p' | awk -F'/' '{ if ($2>0) printf "%.2f", $1/$2; else print $1 }')

    local needs_reencode=0
    local scale_filter=()
    local framerate_filter=()
    local audio_opts=()

    # Check codec
    if [[ "$codec" != "h264" ]]; then
        needs_reencode=1
    fi

    # Check dimensions
    if (( width > 1280 || height > 1280 )); then
        needs_reencode=1
        # Use proper ffmpeg scale filter syntax for aspect ratio and max size
        scale_filter=(-vf "scale=if(gt(a\,1)\,1280\,-2):if(lte(a\,1)\,1280\,-2),format=yuv420p")
    fi

    # Check framerate
    if (( $(echo "$fps > 30" | bc -l) )); then
        needs_reencode=1
        framerate_filter=(-r 30)
    fi

    # If no re-encoding needed
    if (( needs_reencode == 0 )); then
        echo "No scaling or re-encoding needed for $file"
        return 0
    fi

    # Audio options
    local has_audio
    has_audio=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null)
    if [[ -n "$has_audio" ]]; then
        audio_opts=(-c:a aac -b:a 128k)
    else
        audio_opts=(-an)
    fi

    # Compose and execute ffmpeg command
    set -x
    ffmpeg -nostdin -i "$file" -c:v libx264 "${scale_filter[@]}" "${framerate_filter[@]}" -preset slow "${audio_opts[@]}" "$out_file"
    set +x
}

#ffmpeg -i video-original/2019/11/ein-haus-am-see-fuer-die-alpenueberquerung/media/DJI_0035_web.mp4 -c:v libx264 -vf 'scale=if(gt(a\,1)\,1280\,-2):if(lte(a\,1)\,1280\,-2),format=yuv420p' -preset slow -an temp.mp4

# Automated batch processing for all video files in video-original/
[[ -f temp.mp4 ]] && rm -f temp.mp4

find video-original -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.mkv' -o -iname '*.avi' \) -print0 | \
while IFS= read -r -d '' vidfile; do
    check_and_scale_video "$vidfile" temp.mp4
    if [[ -f temp.mp4 ]]; then
        mv -f temp.mp4 "$vidfile"
        echo "Replaced $vidfile with scaled version."
    fi
    [[ -f temp.mp4 ]] && rm -f temp.mp4

    # Optional: add a short sleep to avoid overloading system
    # sleep 1
done
