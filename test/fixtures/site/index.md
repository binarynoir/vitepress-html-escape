# Prose a contributor might write {#prose}

<script setup lang="ts">
import { ref } from 'vue';
const items = ref<string[]>(['a']);
</script>

Generics: Array<string>, Array<object>, Promise<T> and Record<K, V>.

Placeholders: replace <your-name>, then a stray </div> by mistake.

<your-placeholder>
continues with **bold** text.

Interpolation {{ 1 + 1 }} and an object {a: 1}.

PHP inline: <?php echo 1 ?> and CDATA: <![CDATA[ x ]]>.

Status ((tag|Done)), a badge <Badge type="tip" text="ok" /> and keys <kbd>Ctrl</kbd>+<kbd>C</kbd><br>

Our SSG builds this page.

Items: {{ items.length }}

Inline code `{{ items.length }}` shows as written.

    indented {{ items.length }}

Line one</br>line two</BR>line three, an image end tag</IMG> dropped.

::: tip
Inside a container: Map<K, V> and Set<T>.
:::

- tight one
- <list-placeholder>
- tight three

> Quoted Promise<Result>.

| Type    | Example            |
| ------- | ------------------ |
| List<T> | <Badge text="x" /> |

<details>
<summary>More</summary>

Body with Iterable<T>.

</details>

```ts
const kept: Array<T> = [];
```
