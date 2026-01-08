import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Initialize ZAI instance (singleton pattern)
let zaiInstance: any = null;

async function getZAIInstance() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData, prompt, quality, duration, fps, size } = body;

    // Validate required parameters
    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    if (!imageData.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Invalid image data format. Must be a base64-encoded image with data URL format' },
        { status: 400 }
      );
    }

    // Get ZAI instance
    const zai = await getZAIInstance();

    // Create video generation task
    const task = await zai.video.generations.create({
      image_url: imageData, // Base64-encoded image with data URL
      prompt: prompt || 'Make this image come alive with smooth, loopable motion',
      quality: quality || 'speed', // Default to speed for faster generation
      duration: duration || 5,
      fps: fps || 30,
      size: size || '1024x1024'
    });

    console.log('Video generation task created:', task.id);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: task.task_status
    });

  } catch (error) {
    console.error('Error creating video generation task:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create video generation task'
      },
      { status: 500 }
    );
  }
}
