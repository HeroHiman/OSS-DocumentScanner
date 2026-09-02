<script lang="ts">
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { Application, EventData, Page, PanGestureEventData, Utils, View } from '@nativescript/core';
    import { AndroidActivityBackPressedEventData } from '@nativescript/core/application';
    import { prompt } from '@nativescript/core/ui/dialogs';
    import { closeModal } from '@shared/utils/svelte/ui';
    import { showError } from '@shared/utils/showError';
    import { onDestroy, onMount } from 'svelte';
    import CActionBar from '~/components/common/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { OCRDocument, OCRPage } from '~/models/OCRDocument';
    import { burnTextToImageFile } from '~/utils/textOverlay';
    import { hideLoading, onBackButton, showLoading, showSnack } from '~/utils/ui';
    import { colors, fonts, screenHeightDips, screenWidthDips, windowInset } from '~/variables';

    let { colorBackground, colorOnBackground, colorPrimary, colorOutline, colorSurfaceContainer } = $colors;
    $: ({ colorBackground, colorOnBackground, colorPrimary, colorOutline, colorSurfaceContainer } = $colors);

    export let item: OCRPage;
    export let document: OCRDocument;
    export let pageIndex: number;

    let page: NativeViewElementNode<Page>;
    const visualState = isEInk ? colorBackground : 'black';
    const textColor = isEInk ? colorOnBackground : 'white';

    // Text state
    let overlayText = lc('tap_to_edit_text');
    let textX = 40;
    let textY = 100;
    let panStartX = 0;
    let panStartY = 0;
    let selectedColor = '#ff0000';
    let fontSize = 24;

    // Viewport dimensions
    let containerWidth = screenWidthDips;
    let containerHeight = screenHeightDips - 200;

    const availableColors = [
        { name: 'Red', hex: '#ff0000' },
        { name: 'Black', hex: '#000000' },
        { name: 'Blue', hex: '#0055ff' },
        { name: 'Green', hex: '#00aa00' },
        { name: 'Yellow', hex: '#ffcc00' },
        { name: 'White', hex: '#ffffff' },
        { name: 'Purple', hex: '#8800cc' },
        { name: 'Orange', hex: '#ff8800' }
    ];

    function onContainerLayout(event: EventData) {
        const view = event.object as View;
        if (view) {
            const measuredW = Utils.layout.toDeviceIndependentPixels(view.getMeasuredWidth());
            const measuredH = Utils.layout.toDeviceIndependentPixels(view.getMeasuredHeight());
            if (measuredW > 0 && measuredH > 0) {
                containerWidth = measuredW;
                containerHeight = measuredH;
            }
        }
    }

    // Open a native dialog to edit the text safely
    async function editTextDialog() {
        try {
            const result = await prompt({
                title: lc('add_text'),
                message: lc('tap_to_edit_text'),
                defaultText: overlayText === lc('tap_to_edit_text') ? '' : overlayText,
                okButtonText: lc('apply'),
                cancelButtonText: lc('cancel')
            });

            if (result.result && result.text.trim() !== '') {
                overlayText = result.text;
            }
        } catch (error) {
            showError(error);
        }
    }

    function onPan(args: PanGestureEventData) {
        if (args.state === 1) {
            // Start pan
            panStartX = textX;
            panStartY = textY;
        } else if (args.state === 2) {
            // Panning
            textX = Math.max(0, Math.min(containerWidth - 60, panStartX + args.deltaX));
            textY = Math.max(0, Math.min(containerHeight - 40, panStartY + args.deltaY));
        }
    }

    function onGoBack() {
        closeModal(false);
    }

    async function onSave() {
        if (!overlayText || !overlayText.trim() || overlayText === lc('tap_to_edit_text')) {
            closeModal(false);
            return;
        }
        try {
            await showLoading(lc('computing'));
            const result = await burnTextToImageFile({
                imagePath: item.imagePath,
                text: overlayText,
                screenX: textX,
                screenY: textY,
                containerWidth,
                containerHeight,
                fontSize,
                color: selectedColor
            });

            if (result.success) {
                await document.updatePage(
                    pageIndex,
                    {
                        size: result.size,
                        width: result.width,
                        height: result.height
                    },
                    true
                );
                showSnack({ message: lc('save') });
                closeModal(true);
            } else {
                throw new Error('Failed to burn text to image');
            }
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
    }

    const onAndroidBackButton = (data: AndroidActivityBackPressedEventData) =>
        onBackButton(page?.nativeView, () => {
            data.cancel = true;
            onGoBack();
        });

    onMount(() => {
        if (__ANDROID__) {
            Application.android.on(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
    });

    onDestroy(() => {
        if (__ANDROID__) {
            Application.android.off(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
    });
</script>

<page bind:this={page} id="modalTextEdit" actionBarHidden={true} statusBarStyle="dark">
    <gridlayout class="pageContent" backgroundColor={visualState} rows="auto,*,auto" android:paddingBottom={$windowInset.bottom}>
        <!-- Top Action Bar -->
        <CActionBar backgroundColor="transparent" buttonsDefaultVisualState={visualState} modalWindow={true} title={lc('add_text')}>
            <mdbutton class="actionBarButton" defaultVisualState={visualState} text="mdi-check" variant="text" on:tap={onSave} />
        </CActionBar>

        <!-- Canvas / Document Page Preview Layer -->
        <gridlayout row={1} on:layoutChanged={onContainerLayout} clipToBounds={true}>
            <image src={item.imagePath} stretch="aspectFit" width="100%" height="100%" />

            <!-- Interactive Absolute Text Placement Layer -->
            <absolutelayout width="100%" height="100%">
                <label
                    text={overlayText}
                    left={textX}
                    top={textY}
                    on:pan={onPan}
                    on:tap={editTextDialog}
                    color={selectedColor}
                    fontSize={fontSize}
                    fontWeight="bold"
                    padding="4"
                    borderWidth="2"
                    borderColor={selectedColor}
                    backgroundColor="#00000033"
                    borderRadius={4}
                    textWrap={true}
                />
            </absolutelayout>
        </gridlayout>

        <!-- Bottom Controls Layer -->
        <stacklayout row={2} backgroundColor={colorSurfaceContainer} padding={12} borderTopColor={colorOutline} borderTopWidth={1}>
            <!-- Tap to edit text card/button -->
            <gridlayout columns="*,auto" margin="0 0 8 0" backgroundColor="#00000022" borderRadius={8} padding="10 12" on:tap={editTextDialog}>
                <label
                    col={0}
                    text={overlayText}
                    color={textColor}
                    fontSize={15}
                    verticalAlignment="center"
                    maxLines={2}
                    lineBreak="end"
                />
                <label
                    col={1}
                    text="mdi-pencil"
                    fontFamily={$fonts.mdi}
                    fontSize={20}
                    color={colorPrimary}
                    verticalAlignment="center"
                    marginLeft={8}
                />
            </gridlayout>

            <!-- Font Size & Color Palette Selector -->
            <gridlayout columns="auto,*,auto" verticalAlignment="center" margin="4 0 4 0">
                <label col={0} text={`Size: ${fontSize}px`} color={textColor} fontSize={14} verticalAlignment="center" marginRight={8} />
                <slider
                    col={1}
                    value={fontSize}
                    minValue={12}
                    maxValue={72}
                    on:valueChange={(e) => (fontSize = Math.round(e.value))}
                    verticalAlignment="center"
                />
            </gridlayout>

            <!-- Color Selection Chips -->
            <scrollview orientation="horizontal" height={40} margin="4 0 0 0">
                <stacklayout orientation="horizontal">
                    {#each availableColors as c}
                        <gridlayout
                            width={32}
                            height={32}
                            borderRadius={16}
                            backgroundColor={c.hex}
                            borderColor={selectedColor === c.hex ? colorPrimary : colorOutline}
                            borderWidth={selectedColor === c.hex ? 3 : 1}
                            margin="0 4 0 4"
                            on:tap={() => (selectedColor = c.hex)}
                        />
                    {/each}
                </stacklayout>
            </scrollview>
        </stacklayout>
    </gridlayout>
</page>
