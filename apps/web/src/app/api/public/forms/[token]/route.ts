import { NextResponse, type NextRequest } from 'next/server';
import { getPublicFormData } from '@/lib/public-form';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const invitationToken = request.nextUrl.searchParams.get('i');
  const data = await getPublicFormData(params.token, invitationToken);

  if (!data) {
    return NextResponse.json({ error: 'This form is not available. It may not be published yet.' }, { status: 404 });
  }

  return NextResponse.json(data);
}
