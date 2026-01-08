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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');

    // Validate required parameters
    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Get ZAI instance
    const zai = await getZAIInstance();

    // Query task status
    const result = await zai.async.result.query(taskId);

    console.log('Video generation task status:', taskId, result.task_status);

    const response: any = {
      taskId: taskId,
      status: result.task_status
    };

    // If successful, extract video URL from multiple possible fields
    if (result.task_status === 'SUCCESS') {
      const videoUrl = result.video_result?.[0]?.url ||
                      result.video_url ||
                      result.url ||
                      result.video;

      if (videoUrl) {
        response.videoUrl = videoUrl;
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error querying video generation status:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to query video generation status'
      },
      { status: 500 }
    );
  }
}
