'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Upload, Play, Download, Sparkles, Film, Settings, Image as ImageIcon, X, Loader2 } from 'lucide-react';

type VideoQuality = 'speed' | 'quality';
type Duration = '5' | '10';
type FPS = '30' | '60';
type Resolution = '1024x1024' | '1920x1080' | '1080x1920' | '1344x768' | '768x1344' | '864x1152' | '1152x864';

interface GenerateState {
  isUploading: boolean;
  isGenerating: boolean;
  isPolling: boolean;
  progress: number;
  status: string;
}

export default function ImageToVideoPage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  // Video generation parameters
  const [prompt, setPrompt] = useState('Make this image come alive with smooth, loopable motion');
  const [quality, setQuality] = useState<VideoQuality>('speed'); // Default to speed for faster generation
  const [duration, setDuration] = useState<Duration>('5');
  const [fps, setFps] = useState<FPS>('30');
  const [resolution, setResolution] = useState<Resolution>('1024x1024');

  // UI states
  const [generateState, setGenerateState] = useState<GenerateState>({
    isUploading: false,
    isGenerating: false,
    isPolling: false,
    progress: 0,
    status: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Please upload an image smaller than 10MB'
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload an image file (JPEG, PNG, WebP)'
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setGeneratedVideoUrl(null);
        setTaskId(null);
        setGenerateState({
          isUploading: false,
          isGenerating: false,
          isPolling: false,
          progress: 0,
          status: ''
        });
        toast({
          title: 'Image uploaded',
          description: 'Your image is ready to be transformed into a video'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Please upload an image smaller than 10MB'
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setGeneratedVideoUrl(null);
        setTaskId(null);
        setGenerateState({
          isUploading: false,
          isGenerating: false,
          isPolling: false,
          progress: 0,
          status: ''
        });
        toast({
          title: 'Image uploaded',
          description: 'Your image is ready to be transformed into a video'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const generateVideo = async () => {
    if (!uploadedImage) {
      toast({
        variant: 'destructive',
        title: 'No image uploaded',
        description: 'Please upload an image first'
      });
      return;
    }

    setGenerateState({
      isUploading: true,
      isGenerating: true,
      isPolling: false,
      progress: 10,
      status: 'Creating video generation task...'
    });

    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: uploadedImage,
          prompt,
          quality,
          duration: parseInt(duration),
          fps: parseInt(fps),
          size: resolution
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create video generation task');
      }

      setTaskId(data.taskId);
      setGenerateState(prev => ({
        ...prev,
        isUploading: false,
        isPolling: true,
        progress: 20,
        status: 'Task created. Starting video generation...'
      }));

      // Start polling for results
      pollForResults(data.taskId);

    } catch (error) {
      console.error('Error generating video:', error);
      setGenerateState({
        isUploading: false,
        isGenerating: false,
        isPolling: false,
        progress: 0,
        status: ''
      });
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate video'
      });
    }
  };

  const pollForResults = async (taskId: string) => {
    const maxPolls = 200; // Increased to allow up to 10 minutes (200 × 3 seconds)
    const pollInterval = 3000; // 3 seconds
    let pollCount = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/video/status?taskId=${taskId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check status');
        }

        // Calculate elapsed time in minutes
        const elapsedMinutes = ((pollCount * pollInterval) / 60000).toFixed(1);

        // Update progress - slower progression for longer wait times
        const progress = Math.min(20 + (pollCount / maxPolls) * 70, 90);
        setGenerateState(prev => ({
          ...prev,
          progress,
          status: data.status === 'PROCESSING'
            ? `Generating your animated video... (${elapsedMinutes} minutes elapsed)`
            : 'Almost done...'
        }));

        if (data.status === 'SUCCESS' && data.videoUrl) {
          setGeneratedVideoUrl(data.videoUrl);
          setGenerateState({
            isUploading: false,
            isGenerating: false,
            isPolling: false,
            progress: 100,
            status: 'Video generated successfully!'
          });
          toast({
            title: 'Success!',
            description: 'Your animated video has been generated'
          });
          return;
        }

        if (data.status === 'FAIL') {
          throw new Error('Video generation failed');
        }

        if (pollCount < maxPolls) {
          pollCount++;
          setTimeout(poll, pollInterval);
        } else {
          throw new Error(`Video generation timed out after ${elapsedMinutes} minutes. Please try again or use "speed" mode for faster generation.`);
        }

      } catch (error) {
        console.error('Error polling status:', error);
        setGenerateState({
          isUploading: false,
          isGenerating: false,
          isPolling: false,
          progress: 0,
          status: ''
        });
        toast({
          variant: 'destructive',
          title: 'Generation failed',
          description: error instanceof Error ? error.message : 'Failed to generate video'
        });
      }
    };

    poll();
  };

  const handleDownload = () => {
    if (generatedVideoUrl) {
      const link = document.createElement('a');
      link.href = generatedVideoUrl;
      link.download = `animated-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: 'Download started',
        description: 'Your video is being downloaded'
      });
    }
  };

  const resetUpload = () => {
    setUploadedImage(null);
    setGeneratedVideoUrl(null);
    setTaskId(null);
    setGenerateState({
      isUploading: false,
      isGenerating: false,
      isPolling: false,
      progress: 0,
      status: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-950">
      <div className="container mx-auto px-4 py-8 pb-20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Image to Animated Video
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Transform your static images into stunning, loopable animated videos with AI
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left Column - Upload and Settings */}
          <div className="space-y-6">
            {/* Upload Card */}
            <Card className="shadow-lg border-2 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  Upload Image
                </CardTitle>
                <CardDescription>
                  Upload an image to transform into an animated loop video
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!uploadedImage ? (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Drag and drop an image here, or click to browse
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Supports JPEG, PNG, WebP (Max 10MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-full rounded-lg shadow-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={resetUpload}
                      className="absolute top-2 right-2 rounded-full w-8 h-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card className="shadow-lg border-2 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  Video Settings
                </CardTitle>
                <CardDescription>
                  Customize your animated video parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="prompt">Animation Prompt</Label>
                  <Input
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe how you want the animation to look"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Describe the animation style and motion you want
                  </p>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Select value={duration} onValueChange={(value: Duration) => setDuration(value)}>
                    <SelectTrigger id="duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quality */}
                <div className="space-y-2">
                  <Label htmlFor="quality">Quality Mode</Label>
                  <Select value={quality} onValueChange={(value: VideoQuality) => setQuality(value)}>
                    <SelectTrigger id="quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="speed">Speed (faster generation)</SelectItem>
                      <SelectItem value="quality">Quality (better results, slower)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Speed mode generates quickly (1-3 min), Quality mode takes longer (5-10 min)
                  </p>
                </div>

                {/* FPS */}
                <div className="space-y-2">
                  <Label htmlFor="fps">Frame Rate</Label>
                  <Select value={fps} onValueChange={(value: FPS) => setFps(value)}>
                    <SelectTrigger id="fps">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 FPS</SelectItem>
                      <SelectItem value="60">60 FPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Resolution */}
                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolution</Label>
                  <Select value={resolution} onValueChange={(value: Resolution) => setResolution(value)}>
                    <SelectTrigger id="resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024x1024">1024x1024 (Square)</SelectItem>
                      <SelectItem value="1920x1080">1920x1080 (Landscape)</SelectItem>
                      <SelectItem value="1080x1920">1080x1920 (Portrait)</SelectItem>
                      <SelectItem value="1344x768">1344x768 (Wide)</SelectItem>
                      <SelectItem value="768x1344">768x1344 (Tall)</SelectItem>
                      <SelectItem value="864x1152">864x1152 (Portrait)</SelectItem>
                      <SelectItem value="1152x864">1152x864 (Landscape)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={generateVideo}
                  disabled={!uploadedImage || generateState.isGenerating}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-lg"
                  size="lg"
                >
                  {generateState.isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Animated Video
                    </>
                  )}
                </Button>

                {/* Progress */}
                {generateState.isGenerating && (
                  <div className="space-y-2">
                    <Progress value={generateState.progress} className="h-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      {generateState.status}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Result */}
          <div>
            <Card className="shadow-lg border-2 hover:border-purple-300 dark:hover:border-purple-700 transition-colors sticky top-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-purple-600" />
                  Generated Video
                </CardTitle>
                <CardDescription>
                  Your animated loop video will appear here
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedVideoUrl ? (
                  <div className="space-y-4">
                    <video
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full rounded-lg shadow-md"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDownload}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Video
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                    <Play className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      No video generated yet
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Upload an image and click generate to create your animated video
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
