export const starterCode: Record<string, string> = {
  cpp17: `#include <bits/stdc++.h>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  long long a, b;
  if (!(cin >> a >> b)) return 0;
  cout << a + b << "\\n";
  return 0;
}
`,
  c11: `#include <stdio.h>

int main(void) {
  long long a, b;
  if (scanf("%lld %lld", &a, &b) != 2) return 0;
  printf("%lld\\n", a + b);
  return 0;
}
`,
  java11: `import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.StreamTokenizer;

public class Main {
  public static void main(String[] args) throws Exception {
    StreamTokenizer in = new StreamTokenizer(
        new BufferedReader(new InputStreamReader(System.in)));
    if (in.nextToken() == StreamTokenizer.TT_EOF) return;
    long a = (long) in.nval;
    if (in.nextToken() == StreamTokenizer.TT_EOF) return;
    long b = (long) in.nval;
    System.out.println(a + b);
  }
}
`,
  nodejs: `const fs = require("fs");

const input = fs.readFileSync(0, "utf8").trim().split(/\\s+/);
if (input.length >= 2) {
  const a = BigInt(input[0]);
  const b = BigInt(input[1]);
  console.log((a + b).toString());
}
`,
  python3: `a, b = map(int, input().split())
print(a + b)
`,
};
