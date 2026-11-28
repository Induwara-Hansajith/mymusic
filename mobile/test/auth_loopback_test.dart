import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mymusic_mobile/services/auth_sync_service.dart';

void main() {
  test('AuthLoopbackServer receives PKCE code and POST hash tokens', () async {
    final server = AuthLoopbackServer();
    final port = await server.bind(startPort: 54421, maxPort: 54430);
    expect(port, isNotNull);

    final resultFuture = server.waitForResult(timeout: const Duration(seconds: 5));
    final client = HttpClient();
    final req = await client.getUrl(
      Uri.parse('http://127.0.0.1:$port/auth/callback?code=pkce_test_code'),
    );
    final res = await req.close();
    expect(res.statusCode, HttpStatus.ok);
    await res.drain<void>();

    final res1 = await resultFuture;
    expect(res1?.code, 'pkce_test_code');
    expect(res1?.error, isNull);

    final port2 = await server.bind(startPort: 54421, maxPort: 54430);
    expect(port2, isNotNull);
    final resultFuture2 = server.waitForResult(timeout: const Duration(seconds: 5));
    final postReq = await client.postUrl(
      Uri.parse('http://127.0.0.1:$port2/token'),
    );
    postReq.headers.contentType = ContentType.json;
    postReq.write(jsonEncode({
      'access_token': 'acc_tok_1',
      'refresh_token': 'ref_tok_1',
    }));
    final postRes = await postReq.close();
    expect(postRes.statusCode, HttpStatus.ok);
    await postRes.drain<void>();

    final res2 = await resultFuture2;
    expect(res2?.accessToken, 'acc_tok_1');
    expect(res2?.refreshToken, 'ref_tok_1');
    client.close();
  });
}
